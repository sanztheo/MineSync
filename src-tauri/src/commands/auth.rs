use chrono::Utc;

use crate::errors::{AppError, AppResult};
use crate::models::account::Account;
use crate::models::auth::{AuthPollResult, DeviceCodeInfo, MinecraftProfile};
use crate::services::auth::{AuthService, PollResult};
use crate::services::database::DatabaseService;

#[tauri::command]
pub async fn start_auth(
    auth: tauri::State<'_, AuthService>,
) -> AppResult<DeviceCodeInfo> {
    auth.start_device_code_flow().await
}

#[tauri::command]
pub async fn poll_auth(
    auth: tauri::State<'_, AuthService>,
    db: tauri::State<'_, DatabaseService>,
) -> AppResult<AuthPollResult> {
    let result = auth.poll_for_token().await?;

    match result {
        PollResult::Pending => Ok(AuthPollResult::Pending),
        PollResult::Expired => Ok(AuthPollResult::Expired),
        PollResult::Error(msg) => Ok(AuthPollResult::Error { message: msg }),
        PollResult::Success(data) => {
            let now = Utc::now();
            let account = Account {
                id: uuid::Uuid::new_v4().to_string(),
                username: data.username.clone(),
                uuid: data.uuid.clone(),
                access_token: Some(data.mc_access_token),
                refresh_token: Some(data.ms_refresh_token),
                token_expires_at: Some(data.mc_token_expires_at),
                is_active: true,
                created_at: now,
                updated_at: now,
            };
            db.save_account(&account)?;

            Ok(AuthPollResult::Success {
                username: data.username,
                uuid: data.uuid,
            })
        }
    }
}

#[tauri::command]
pub fn get_profile(
    db: tauri::State<'_, DatabaseService>,
) -> AppResult<Option<MinecraftProfile>> {
    let account = db.get_active_account()?;
    Ok(account.map(|a| MinecraftProfile {
        username: a.username,
        uuid: a.uuid,
    }))
}

#[tauri::command]
pub fn logout(db: tauri::State<'_, DatabaseService>) -> AppResult<()> {
    db.deactivate_all_accounts()
}

#[tauri::command]
pub async fn refresh_auth(
    auth: tauri::State<'_, AuthService>,
    db: tauri::State<'_, DatabaseService>,
) -> AppResult<MinecraftProfile> {
    let account = db.get_active_account()?.ok_or_else(|| {
        AppError::Custom("No active account to refresh".to_string())
    })?;

    let refresh_token = account.refresh_token.ok_or_else(|| {
        AppError::Custom("No refresh token stored for active account".to_string())
    })?;

    let data = auth.refresh_tokens(&refresh_token).await?;

    db.update_account_tokens(
        &data.uuid,
        &data.mc_access_token,
        &data.ms_refresh_token,
        &data.mc_token_expires_at,
    )?;

    Ok(MinecraftProfile {
        username: data.username,
        uuid: data.uuid,
    })
}
