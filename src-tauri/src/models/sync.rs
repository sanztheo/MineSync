use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncSession {
    pub id: String,
    pub instance_id: String,
    pub share_code: Option<String>,
    pub peer_id: Option<String>,
    pub is_host: bool,
    pub status: SyncStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    Inactive,
    Active,
    Syncing,
}

impl std::fmt::Display for SyncStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Inactive => write!(f, "inactive"),
            Self::Active => write!(f, "active"),
            Self::Syncing => write!(f, "syncing"),
        }
    }
}

impl std::str::FromStr for SyncStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "inactive" => Ok(Self::Inactive),
            "active" => Ok(Self::Active),
            "syncing" => Ok(Self::Syncing),
            other => Err(format!("Unknown sync status: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SyncHistory {
    pub id: String,
    pub session_id: String,
    pub action: SyncAction,
    pub peer_name: Option<String>,
    pub mods_added: i32,
    pub mods_removed: i32,
    pub mods_updated: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncAction {
    Joined,
    Synced,
    Updated,
    Left,
}

impl std::fmt::Display for SyncAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Joined => write!(f, "joined"),
            Self::Synced => write!(f, "synced"),
            Self::Updated => write!(f, "updated"),
            Self::Left => write!(f, "left"),
        }
    }
}

impl std::str::FromStr for SyncAction {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "joined" => Ok(Self::Joined),
            "synced" => Ok(Self::Synced),
            "updated" => Ok(Self::Updated),
            "left" => Ok(Self::Left),
            other => Err(format!("Unknown sync action: {other}")),
        }
    }
}

/// Manifest used for P2P sync protocol (not stored in DB directly)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncManifest {
    pub instance_id: String,
    pub minecraft_version: String,
    pub loader: String,
    pub loader_version: Option<String>,
    pub mods: Vec<SyncModEntry>,
    pub created_at: DateTime<Utc>,
}

/// Single mod entry within a sync manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncModEntry {
    pub name: String,
    pub version: String,
    pub source: String,
    pub source_id: Option<String>,
    pub file_hash: Option<String>,
}
