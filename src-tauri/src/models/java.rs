use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum JavaRuntimeStatus {
    Ready {
        java_path: String,
        major_version: u32,
        source: String,
    },
    Missing,
    Installing {
        stage: String,
        percent: f32,
        downloaded_bytes: u64,
        total_bytes: Option<u64>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaInstallResult {
    pub java_path: String,
    pub major_version: u32,
    pub install_dir: String,
}
