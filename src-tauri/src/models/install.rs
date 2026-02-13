use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// --- Install progress tracking ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum InstallStage {
    FetchingInfo,
    DownloadingPack,
    ExtractingPack,
    CreatingInstance,
    DownloadingMinecraft,
    InstallingLoader,
    ResolvingMods,
    DownloadingMods { current: u32, total: u32 },
    CopyingOverrides,
    RegisteringMods,
    Completed,
    Failed { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub stage: InstallStage,
    pub overall_percent: f32,
    pub instance_id: Option<String>,
    pub modpack_name: Option<String>,
    pub modpack_icon_url: Option<String>,
}

impl InstallProgress {
    pub fn new(stage: InstallStage, percent: f32) -> Self {
        Self {
            stage,
            overall_percent: percent,
            instance_id: None,
            modpack_name: None,
            modpack_icon_url: None,
        }
    }

    pub fn idle() -> Self {
        Self {
            stage: InstallStage::Completed,
            overall_percent: 100.0,
            instance_id: None,
            modpack_name: None,
            modpack_icon_url: None,
        }
    }
}

// --- CurseForge manifest.json (inside modpack ZIP) ---

#[derive(Debug, Clone, Deserialize)]
pub struct CfManifest {
    pub minecraft: CfMinecraftInfo,
    pub name: String,
    pub version: String,
    pub author: String,
    pub files: Vec<CfManifestFile>,
    pub overrides: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CfMinecraftInfo {
    pub version: String,
    #[serde(rename = "modLoaders")]
    pub mod_loaders: Vec<CfModLoaderInfo>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CfModLoaderInfo {
    pub id: String,
    pub primary: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CfManifestFile {
    pub project_i_d: u32,
    pub file_i_d: u32,
    pub required: bool,
}

// --- Modrinth modrinth.index.json (inside .mrpack ZIP) ---

#[derive(Debug, Clone, Deserialize)]
pub struct MrIndex {
    pub name: String,
    #[serde(rename = "versionId")]
    pub version_id: Option<String>,
    pub dependencies: HashMap<String, String>,
    pub files: Vec<MrIndexFile>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MrIndexFile {
    pub path: String,
    pub hashes: MrFileHashes,
    pub downloads: Vec<String>,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MrFileHashes {
    pub sha1: String,
    pub sha512: Option<String>,
}
