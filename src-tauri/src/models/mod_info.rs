use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModInfo {
    pub id: String,
    pub instance_id: String,
    pub name: String,
    pub slug: Option<String>,
    pub version: String,
    pub file_name: String,
    pub file_hash: Option<String>,
    pub source: ModSource,
    pub source_project_id: Option<String>,
    pub source_version_id: Option<String>,
    pub is_active: bool,
    pub installed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ModSource {
    CurseForge,
    Modrinth,
    Local,
}

impl std::fmt::Display for ModSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::CurseForge => write!(f, "curseforge"),
            Self::Modrinth => write!(f, "modrinth"),
            Self::Local => write!(f, "local"),
        }
    }
}

impl std::str::FromStr for ModSource {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "curseforge" => Ok(Self::CurseForge),
            "modrinth" => Ok(Self::Modrinth),
            "local" => Ok(Self::Local),
            other => Err(format!("Unknown mod source: {other}")),
        }
    }
}
