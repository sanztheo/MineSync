use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MinecraftInstance {
    pub id: String,
    pub name: String,
    pub minecraft_version: String,
    pub loader: ModLoader,
    pub loader_version: Option<String>,
    pub instance_path: String,
    pub icon_path: Option<String>,
    pub icon_url: Option<String>,
    pub description: Option<String>,
    pub last_played_at: Option<DateTime<Utc>>,
    pub total_play_time: i64,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ModLoader {
    Vanilla,
    Forge,
    Fabric,
    NeoForge,
    Quilt,
}

impl std::fmt::Display for ModLoader {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Vanilla => write!(f, "vanilla"),
            Self::Forge => write!(f, "forge"),
            Self::Fabric => write!(f, "fabric"),
            Self::NeoForge => write!(f, "neoforge"),
            Self::Quilt => write!(f, "quilt"),
        }
    }
}

impl std::str::FromStr for ModLoader {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "vanilla" => Ok(Self::Vanilla),
            "forge" => Ok(Self::Forge),
            "fabric" => Ok(Self::Fabric),
            "neoforge" => Ok(Self::NeoForge),
            "quilt" => Ok(Self::Quilt),
            other => Err(format!("Unknown mod loader: {other}")),
        }
    }
}
