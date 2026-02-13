use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::errors::{AppError, AppResult};
use crate::services::download::DownloadTask;

const MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const ASSETS_BASE_URL: &str = "https://resources.download.minecraft.net";

// --- Mojang API response types ---

#[derive(Deserialize)]
struct VersionManifest {
    #[allow(dead_code)]
    latest: LatestVersions,
    versions: Vec<VersionEntry>,
}

#[derive(Deserialize)]
struct LatestVersions {
    #[allow(dead_code)]
    release: String,
    #[allow(dead_code)]
    snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionEntry {
    pub id: String,
    #[serde(alias = "type")]
    pub version_type: String,
    pub url: String,
    #[serde(alias = "releaseTime")]
    pub release_time: String,
}

#[derive(Deserialize)]
pub struct VersionDetail {
    pub id: String,
    pub downloads: VersionDownloads,
    pub libraries: Vec<Library>,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndexInfo,
    #[serde(rename = "javaVersion")]
    pub java_version: Option<JavaVersion>,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    pub arguments: Option<VersionArguments>,
}

#[derive(Deserialize)]
pub struct VersionArguments {
    pub game: Option<Vec<serde_json::Value>>,
    pub jvm: Option<Vec<serde_json::Value>>,
}

#[derive(Deserialize)]
pub struct VersionDownloads {
    pub client: DownloadArtifact,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DownloadArtifact {
    pub sha1: String,
    pub size: u64,
    pub url: String,
    pub path: Option<String>,
}

#[derive(Deserialize)]
pub struct Library {
    pub downloads: Option<LibraryDownloads>,
    pub name: String,
    pub rules: Option<Vec<OsRule>>,
    pub natives: Option<HashMap<String, String>>,
}

#[derive(Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<DownloadArtifact>,
    pub classifiers: Option<HashMap<String, DownloadArtifact>>,
}

#[derive(Deserialize)]
pub struct OsRule {
    pub action: String,
    pub os: Option<OsInfo>,
}

#[derive(Deserialize)]
pub struct OsInfo {
    pub name: Option<String>,
}

#[derive(Deserialize)]
pub struct AssetIndexInfo {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Deserialize)]
pub struct JavaVersion {
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

#[derive(Deserialize)]
struct AssetIndex {
    objects: HashMap<String, AssetObject>,
}

#[derive(Deserialize)]
struct AssetObject {
    hash: String,
    size: u64,
}

// --- MinecraftService ---

pub struct MinecraftService {
    client: reqwest::Client,
    base_dir: PathBuf,
    manifest_cache: Mutex<Option<Vec<VersionEntry>>>,
}

impl MinecraftService {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_dir,
            manifest_cache: Mutex::new(None),
        }
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    /// Fetch the version manifest from Mojang and cache it
    pub async fn fetch_version_manifest(&self) -> AppResult<Vec<VersionEntry>> {
        let response = self.client.get(MANIFEST_URL).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "Failed to fetch version manifest: HTTP {}",
                response.status()
            )));
        }

        let manifest: VersionManifest = response.json().await?;

        // Cache for later URL lookups (short lock, after all awaits)
        {
            let mut cache = self.lock_cache()?;
            *cache = Some(manifest.versions.clone());
        }

        Ok(manifest.versions)
    }

    /// Fetch a specific version's detail JSON and save it to disk
    pub async fn fetch_version_detail(&self, version_id: &str) -> AppResult<VersionDetail> {
        let url = self.get_version_url(version_id)?;

        let response = self.client.get(&url).send().await?;
        let body = response.text().await?;

        // Save raw JSON to versions/{id}/{id}.json
        let version_dir = self.base_dir.join("versions").join(version_id);
        tokio::fs::create_dir_all(&version_dir).await?;
        tokio::fs::write(
            version_dir.join(format!("{version_id}.json")),
            &body,
        )
        .await?;

        let detail: VersionDetail =
            serde_json::from_str(&body).map_err(AppError::Serialization)?;
        Ok(detail)
    }

    /// Build the complete list of files to download for a version
    pub async fn resolve_downloads(
        &self,
        detail: &VersionDetail,
    ) -> AppResult<Vec<DownloadTask>> {
        let mut tasks = Vec::new();

        // Client JAR
        let version_dir = self.base_dir.join("versions").join(&detail.id);
        tasks.push(DownloadTask {
            url: detail.downloads.client.url.clone(),
            dest: version_dir.join(format!("{}.jar", detail.id)),
            sha1: Some(detail.downloads.client.sha1.clone()),
            size: detail.downloads.client.size,
        });

        // Libraries (filtered by OS rules)
        self.resolve_libraries(&detail.libraries, &mut tasks);

        // Assets: fetch index, then enumerate objects
        self.resolve_assets(&detail.asset_index, &mut tasks).await?;

        Ok(tasks)
    }

    // --- Private helpers ---

    fn get_version_url(&self, version_id: &str) -> AppResult<String> {
        let cache = self.lock_cache()?;
        let versions = cache.as_ref().ok_or_else(|| {
            AppError::Custom(
                "Version manifest not loaded. Call list_mc_versions first.".to_string(),
            )
        })?;

        versions
            .iter()
            .find(|v| v.id == version_id)
            .map(|v| v.url.clone())
            .ok_or_else(|| {
                AppError::Custom(format!("Version not found: {version_id}"))
            })
    }

    fn resolve_libraries(&self, libraries: &[Library], tasks: &mut Vec<DownloadTask>) {
        let lib_dir = self.base_dir.join("libraries");

        for lib in libraries {
            if !should_include_library(lib) {
                continue;
            }

            let downloads = match &lib.downloads {
                Some(d) => d,
                None => continue,
            };

            // Main artifact
            if let Some(ref artifact) = downloads.artifact {
                if let Some(ref path) = artifact.path {
                    tasks.push(DownloadTask {
                        url: artifact.url.clone(),
                        dest: lib_dir.join(path),
                        sha1: Some(artifact.sha1.clone()),
                        size: artifact.size,
                    });
                }
            }

            // Native classifiers for current OS
            self.resolve_native(lib, downloads, tasks);
        }
    }

    fn resolve_native(
        &self,
        lib: &Library,
        downloads: &LibraryDownloads,
        tasks: &mut Vec<DownloadTask>,
    ) {
        let natives = match &lib.natives {
            Some(n) => n,
            None => return,
        };
        let classifiers = match &downloads.classifiers {
            Some(c) => c,
            None => return,
        };

        let os = current_os_name();
        if let Some(classifier_key) = natives.get(os) {
            if let Some(artifact) = classifiers.get(classifier_key) {
                if let Some(ref path) = artifact.path {
                    let dest = self.base_dir.join("libraries").join(path);
                    tasks.push(DownloadTask {
                        url: artifact.url.clone(),
                        dest,
                        sha1: Some(artifact.sha1.clone()),
                        size: artifact.size,
                    });
                }
            }
        }
    }

    async fn resolve_assets(
        &self,
        asset_info: &AssetIndexInfo,
        tasks: &mut Vec<DownloadTask>,
    ) -> AppResult<()> {
        let assets_dir = self.base_dir.join("assets");

        // Fetch and save asset index
        let response = self.client.get(&asset_info.url).send().await?;
        let body = response.text().await?;

        let index_dir = assets_dir.join("indexes");
        tokio::fs::create_dir_all(&index_dir).await?;
        tokio::fs::write(
            index_dir.join(format!("{}.json", asset_info.id)),
            &body,
        )
        .await?;

        let index: AssetIndex =
            serde_json::from_str(&body).map_err(AppError::Serialization)?;

        let objects_dir = assets_dir.join("objects");
        for obj in index.objects.values() {
            let prefix = &obj.hash[..2];
            tasks.push(DownloadTask {
                url: format!("{ASSETS_BASE_URL}/{prefix}/{}", obj.hash),
                dest: objects_dir.join(prefix).join(&obj.hash),
                sha1: Some(obj.hash.clone()),
                size: obj.size,
            });
        }

        Ok(())
    }

    fn lock_cache(
        &self,
    ) -> AppResult<std::sync::MutexGuard<'_, Option<Vec<VersionEntry>>>> {
        self.manifest_cache
            .lock()
            .map_err(|e| AppError::Custom(format!("Manifest cache lock poisoned: {e}")))
    }
}

// --- OS helpers ---

fn current_os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

/// Evaluate Mojang OS rules to decide if a library should be included
fn should_include_library(lib: &Library) -> bool {
    let rules = match &lib.rules {
        Some(rules) if !rules.is_empty() => rules,
        _ => return true,
    };

    let os = current_os_name();
    let mut allowed = false;

    for rule in rules {
        let matches = match &rule.os {
            None => true,
            Some(info) => info.name.as_deref() == Some(os),
        };
        if matches {
            allowed = rule.action == "allow";
        }
    }

    allowed
}
