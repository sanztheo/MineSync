use serde::{Deserialize, Serialize};

/// Info returned to frontend when device code auth starts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeInfo {
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub message: String,
}

/// Result of polling for auth completion
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum AuthPollResult {
    Pending,
    Success { username: String, uuid: String },
    Expired,
    Error { message: String },
}

/// Minecraft profile info
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MinecraftProfile {
    pub username: String,
    pub uuid: String,
}
