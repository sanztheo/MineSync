use std::sync::Mutex;

use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;

use crate::errors::{AppError, AppResult};
use crate::models::auth::DeviceCodeInfo;

// --- Auth endpoint URLs ---

const MS_DEVICE_CODE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MS_TOKEN_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBL_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_AUTH_URL: &str =
    "https://api.minecraftservices.com/authentication/loginWithXbox";
const MC_PROFILE_URL: &str =
    "https://api.minecraftservices.com/minecraft/profile";

const XBOX_SCOPE: &str = "XboxLive.signin offline_access";

/// Fallback Azure AD client ID if AZURE_CLIENT_ID env var is not set
const FALLBACK_CLIENT_ID: &str = "00000000-0000-0000-0000-000000000000";

// --- Internal API response types ---

#[derive(Deserialize)]
struct MsDeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
    message: String,
}

#[derive(Deserialize)]
struct MsTokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
}

#[derive(Deserialize)]
struct MsTokenErrorResponse {
    error: String,
    error_description: Option<String>,
}

#[derive(Deserialize)]
struct XblAuthResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XblDisplayClaims,
}

#[derive(Deserialize)]
struct XblDisplayClaims {
    xui: Vec<XblXui>,
}

#[derive(Deserialize)]
struct XblXui {
    uhs: String,
}

#[derive(Deserialize)]
struct XstsErrorResponse {
    #[serde(rename = "XErr")]
    xerr: u64,
}

#[derive(Deserialize)]
struct McAuthResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Deserialize)]
struct McProfileResponse {
    id: String,
    name: String,
}

// --- Public types ---

struct PendingAuth {
    device_code: String,
    #[allow(dead_code)]
    interval: u64,
    expires_at: DateTime<Utc>,
}

/// Full auth result returned by internal methods
pub struct FullAuthResult {
    pub mc_access_token: String,
    pub ms_refresh_token: String,
    pub mc_token_expires_at: DateTime<Utc>,
    pub username: String,
    pub uuid: String,
}

/// Result of a single poll attempt
pub enum PollResult {
    Pending,
    Success(FullAuthResult),
    Expired,
    Error(String),
}

// --- AuthService ---

pub struct AuthService {
    client: reqwest::Client,
    client_id: String,
    pending_auth: Mutex<Option<PendingAuth>>,
}

impl AuthService {
    pub fn new() -> Self {
        let client_id = std::env::var("AZURE_CLIENT_ID")
            .unwrap_or_else(|_| FALLBACK_CLIENT_ID.to_string());

        Self {
            client: reqwest::Client::new(),
            client_id,
            pending_auth: Mutex::new(None),
        }
    }

    /// Step 1: Request a device code from Microsoft OAuth
    pub async fn start_device_code_flow(&self) -> AppResult<DeviceCodeInfo> {
        let client_id = self.client_id.clone();

        let response = self
            .client
            .post(MS_DEVICE_CODE_URL)
            .form(&[("client_id", client_id.as_str()), ("scope", XBOX_SCOPE)])
            .send()
            .await?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Custom(format!(
                "Device code request failed: {body}"
            )));
        }

        let data: MsDeviceCodeResponse = response.json().await?;
        let expires_at = Utc::now() + Duration::seconds(data.expires_in as i64);

        // Store pending auth for polling (short-lived lock)
        {
            let mut pending = self.lock_pending()?;
            *pending = Some(PendingAuth {
                device_code: data.device_code,
                interval: data.interval,
                expires_at,
            });
        }

        Ok(DeviceCodeInfo {
            user_code: data.user_code,
            verification_uri: data.verification_uri,
            expires_in: data.expires_in,
            message: data.message,
        })
    }

    /// Step 2: Poll Microsoft for token completion
    pub async fn poll_for_token(&self) -> AppResult<PollResult> {
        let (device_code, client_id) = {
            let pending = self.lock_pending()?;
            let p = pending.as_ref().ok_or_else(|| {
                AppError::Custom("No pending auth flow. Call start_auth first.".to_string())
            })?;

            if Utc::now() > p.expires_at {
                return Ok(PollResult::Expired);
            }

            (p.device_code.clone(), self.client_id.clone())
        }; // MutexGuard dropped before await

        let response = self
            .client
            .post(MS_TOKEN_URL)
            .form(&[
                (
                    "grant_type",
                    "urn:ietf:params:oauth:grant-type:device_code",
                ),
                ("client_id", &client_id),
                ("device_code", &device_code),
            ])
            .send()
            .await?;

        let status = response.status();
        let body = response.text().await?;

        if !status.is_success() {
            return self.handle_token_error(&body);
        }

        let ms_token: MsTokenResponse =
            serde_json::from_str(&body).map_err(|e| AppError::Serialization(e))?;

        match self.complete_auth_chain(&ms_token.access_token).await {
            Ok((mc_auth, profile)) => {
                self.clear_pending()?;
                let expires_at =
                    Utc::now() + Duration::seconds(mc_auth.expires_in as i64);
                Ok(PollResult::Success(FullAuthResult {
                    mc_access_token: mc_auth.access_token,
                    ms_refresh_token: ms_token.refresh_token,
                    mc_token_expires_at: expires_at,
                    username: profile.name,
                    uuid: format_mc_uuid(&profile.id),
                }))
            }
            Err(e) => Ok(PollResult::Error(format!("Auth chain failed: {e}"))),
        }
    }

    /// Refresh auth using stored MS refresh token
    pub async fn refresh_tokens(&self, refresh_token: &str) -> AppResult<FullAuthResult> {
        let client_id = self.client_id.clone();
        let refresh_token = refresh_token.to_string();

        let response = self
            .client
            .post(MS_TOKEN_URL)
            .form(&[
                ("grant_type", "refresh_token"),
                ("client_id", &client_id),
                ("refresh_token", &refresh_token),
                ("scope", XBOX_SCOPE),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Custom(format!("Token refresh failed: {body}")));
        }

        let ms_token: MsTokenResponse = response.json().await?;
        let (mc_auth, profile) = self.complete_auth_chain(&ms_token.access_token).await?;
        let expires_at = Utc::now() + Duration::seconds(mc_auth.expires_in as i64);

        Ok(FullAuthResult {
            mc_access_token: mc_auth.access_token,
            ms_refresh_token: ms_token.refresh_token,
            mc_token_expires_at: expires_at,
            username: profile.name,
            uuid: format_mc_uuid(&profile.id),
        })
    }

    // --- Private: auth chain steps ---

    /// Xbox Live → XSTS → Minecraft Token + Profile
    async fn complete_auth_chain(
        &self,
        ms_access_token: &str,
    ) -> AppResult<(McAuthResponse, McProfileResponse)> {
        let xbl = self.authenticate_xbox_live(ms_access_token).await?;

        let uhs = xbl
            .display_claims
            .xui
            .first()
            .ok_or_else(|| AppError::Custom("No Xbox user hash in response".to_string()))?
            .uhs
            .clone();

        let xsts = self.authenticate_xsts(&xbl.token).await?;
        let mc_auth = self.authenticate_minecraft(&uhs, &xsts.token).await?;
        let profile = self.get_minecraft_profile(&mc_auth.access_token).await?;

        Ok((mc_auth, profile))
    }

    /// Step 3: Authenticate with Xbox Live using MS access token
    async fn authenticate_xbox_live(&self, ms_access_token: &str) -> AppResult<XblAuthResponse> {
        let body = serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={ms_access_token}")
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        });

        let response = self.client.post(XBL_AUTH_URL).json(&body).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(
                "Xbox Live authentication failed".to_string(),
            ));
        }

        Ok(response.json().await?)
    }

    /// Step 4: Get XSTS token from Xbox Live token
    async fn authenticate_xsts(&self, xbl_token: &str) -> AppResult<XblAuthResponse> {
        let body = serde_json::json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        });

        let response = self.client.post(XSTS_AUTH_URL).json(&body).send().await?;

        if !response.status().is_success() {
            let error_msg = self.parse_xsts_error(&response.text().await.unwrap_or_default());
            return Err(AppError::Custom(error_msg));
        }

        Ok(response.json().await?)
    }

    /// Step 5: Get Minecraft token using XSTS credentials
    async fn authenticate_minecraft(
        &self,
        uhs: &str,
        xsts_token: &str,
    ) -> AppResult<McAuthResponse> {
        let body = serde_json::json!({
            "identityToken": format!("XBL3.0 x={uhs};{xsts_token}")
        });

        let response = self.client.post(MC_AUTH_URL).json(&body).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(
                "Minecraft authentication failed".to_string(),
            ));
        }

        Ok(response.json().await?)
    }

    /// Step 6: Fetch Minecraft profile (username + UUID)
    async fn get_minecraft_profile(&self, mc_access_token: &str) -> AppResult<McProfileResponse> {
        let response = self
            .client
            .get(MC_PROFILE_URL)
            .bearer_auth(mc_access_token)
            .send()
            .await?;

        if response.status().as_u16() == 404 {
            return Err(AppError::Custom(
                "This Microsoft account does not own Minecraft Java Edition".to_string(),
            ));
        }

        if !response.status().is_success() {
            return Err(AppError::Custom(
                "Failed to fetch Minecraft profile".to_string(),
            ));
        }

        Ok(response.json().await?)
    }

    // --- Private: helpers ---

    fn lock_pending(
        &self,
    ) -> AppResult<std::sync::MutexGuard<'_, Option<PendingAuth>>> {
        self.pending_auth
            .lock()
            .map_err(|e| AppError::Custom(format!("Auth lock poisoned: {e}")))
    }

    fn clear_pending(&self) -> AppResult<()> {
        let mut pending = self.lock_pending()?;
        *pending = None;
        Ok(())
    }

    fn handle_token_error(&self, body: &str) -> AppResult<PollResult> {
        let error: MsTokenErrorResponse = serde_json::from_str(body)
            .unwrap_or(MsTokenErrorResponse {
                error: "unknown".to_string(),
                error_description: Some(body.to_string()),
            });

        match error.error.as_str() {
            "authorization_pending" | "slow_down" => Ok(PollResult::Pending),
            "expired_token" => {
                self.clear_pending()?;
                Ok(PollResult::Expired)
            }
            _ => Ok(PollResult::Error(
                error
                    .error_description
                    .unwrap_or(error.error),
            )),
        }
    }

    fn parse_xsts_error(&self, body: &str) -> String {
        let xerr = serde_json::from_str::<XstsErrorResponse>(body)
            .map(|e| e.xerr)
            .unwrap_or(0);

        match xerr {
            2148916233 => "This Microsoft account has no Xbox account. Please create one first."
                .to_string(),
            2148916235 => "Xbox Live is not available in your region.".to_string(),
            2148916238 => {
                "This is a child account. A parent must add it to a Microsoft family.".to_string()
            }
            _ => format!("XSTS authorization failed (error code: {xerr})"),
        }
    }
}

/// Minecraft UUIDs come without dashes — format them as standard UUID
fn format_mc_uuid(id: &str) -> String {
    if id.len() == 32 && !id.contains('-') {
        format!(
            "{}-{}-{}-{}-{}",
            &id[..8],
            &id[8..12],
            &id[12..16],
            &id[16..20],
            &id[20..]
        )
    } else {
        id.to_string()
    }
}
