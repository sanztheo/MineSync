use std::io::Read as _;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::errors::{AppError, AppResult};
use crate::models::loader::{LoaderLibrary, LoaderProfile, LoaderVersionEntry};

const MAVEN_URL: &str = "https://maven.minecraftforge.net";
const PROMOTIONS_URL: &str =
    "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";

pub struct ForgeInstaller {
    client: reqwest::Client,
}

// --- Forge promotions API ---

#[derive(Deserialize)]
struct ForgePromotions {
    promos: std::collections::HashMap<String, String>,
}

/// The `version.json` extracted from the Forge installer JAR.
#[derive(Deserialize)]
struct ForgeVersionJson {
    #[serde(rename = "mainClass")]
    main_class: String,
    libraries: Vec<ForgeLibrary>,
    arguments: Option<ForgeArguments>,
}

#[derive(Deserialize)]
struct ForgeLibrary {
    name: String,
    downloads: Option<ForgeLibDownloads>,
}

#[derive(Deserialize)]
struct ForgeLibDownloads {
    artifact: Option<ForgeArtifact>,
}

#[derive(Deserialize)]
struct ForgeArtifact {
    path: String,
    url: String,
    sha1: Option<String>,
    size: u64,
}

#[derive(Deserialize)]
struct ForgeArguments {
    game: Option<Vec<serde_json::Value>>,
    jvm: Option<Vec<serde_json::Value>>,
}

impl ForgeInstaller {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("MineSync/1.0.0")
            .build()
            .unwrap_or_default();

        Self { client }
    }

    /// List Forge versions available for a Minecraft version.
    ///
    /// Uses the promotions API to find recommended/latest Forge versions.
    pub async fn list_versions(&self, game_version: &str) -> AppResult<Vec<LoaderVersionEntry>> {
        let response = self.client.get(PROMOTIONS_URL).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "Forge promotions API failed: HTTP {}",
                response.status()
            )));
        }

        let promos: ForgePromotions = response.json().await?;
        let mut versions = Vec::new();

        // Look for both "recommended" and "latest" keys
        let recommended_key = format!("{game_version}-recommended");
        let latest_key = format!("{game_version}-latest");

        if let Some(v) = promos.promos.get(&recommended_key) {
            versions.push(LoaderVersionEntry {
                loader_version: v.clone(),
                game_version: game_version.to_string(),
                stable: true,
            });
        }

        if let Some(v) = promos.promos.get(&latest_key) {
            // Avoid duplicate if latest == recommended
            let already_listed = versions.iter().any(|e| e.loader_version == *v);
            if !already_listed {
                versions.push(LoaderVersionEntry {
                    loader_version: v.clone(),
                    game_version: game_version.to_string(),
                    stable: false,
                });
            }
        }

        Ok(versions)
    }

    /// Install Forge by downloading the installer JAR and extracting the version profile.
    ///
    /// Same approach as NeoForge: download installer, extract version.json,
    /// parse libraries and arguments.
    pub async fn install(
        &self,
        game_version: &str,
        loader_version: &str,
        base_dir: &Path,
    ) -> AppResult<LoaderProfile> {
        let forge_id = format!("{game_version}-{loader_version}");
        let installer_url = format!(
            "{MAVEN_URL}/net/minecraftforge/forge/{forge_id}/forge-{forge_id}-installer.jar"
        );

        let response = self.client.get(&installer_url).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "Forge installer download failed for {forge_id}: HTTP {}",
                response.status()
            )));
        }

        let installer_bytes = response.bytes().await?;

        // Save installer
        let loader_dir = base_dir.join("loaders").join("forge").join(&forge_id);
        tokio::fs::create_dir_all(&loader_dir).await?;

        let installer_path = loader_dir.join(format!("forge-{forge_id}-installer.jar"));
        tokio::fs::write(&installer_path, &installer_bytes).await?;

        // Extract version.json
        let version_json = extract_version_json_from_jar(&installer_bytes)?;

        let version_json_path = loader_dir.join("version.json");
        tokio::fs::write(&version_json_path, &version_json).await?;

        let profile: ForgeVersionJson = serde_json::from_str(&version_json).map_err(|e| {
            AppError::Custom(format!(
                "Failed to parse Forge version.json for {forge_id}: {e}"
            ))
        })?;

        Ok(forge_profile_to_loader_profile(profile))
    }

    /// Get the path to a previously downloaded installer JAR.
    pub fn installer_path(base_dir: &Path, game_version: &str, loader_version: &str) -> PathBuf {
        let forge_id = format!("{game_version}-{loader_version}");
        base_dir
            .join("loaders")
            .join("forge")
            .join(&forge_id)
            .join(format!("forge-{forge_id}-installer.jar"))
    }
}

// --- Helpers ---

fn extract_version_json_from_jar(jar_bytes: &[u8]) -> AppResult<String> {
    let cursor = std::io::Cursor::new(jar_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| AppError::Custom(format!("Failed to open Forge installer as ZIP: {e}")))?;

    let mut file = archive
        .by_name("version.json")
        .map_err(|e| AppError::Custom(format!("version.json not found in Forge installer: {e}")))?;

    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

fn forge_profile_to_loader_profile(profile: ForgeVersionJson) -> LoaderProfile {
    let libraries = profile
        .libraries
        .into_iter()
        .map(|lib| {
            let (url, path, sha1, size) = match lib.downloads {
                Some(dl) => match dl.artifact {
                    Some(art) => (art.url, art.path, art.sha1, art.size),
                    None => {
                        let path = maven_name_to_path(&lib.name);
                        (String::new(), path, None, 0)
                    }
                },
                None => {
                    let path = maven_name_to_path(&lib.name);
                    let url = format!("{MAVEN_URL}/{path}");
                    (url, path, None, 0)
                }
            };

            LoaderLibrary {
                name: lib.name,
                url,
                path,
                sha1,
                size,
            }
        })
        .collect();

    let game_arguments =
        extract_string_args(profile.arguments.as_ref().and_then(|a| a.game.as_ref()));
    let jvm_arguments =
        extract_string_args(profile.arguments.as_ref().and_then(|a| a.jvm.as_ref()));

    LoaderProfile {
        main_class: profile.main_class,
        libraries,
        game_arguments,
        jvm_arguments,
    }
}

fn extract_string_args(args: Option<&Vec<serde_json::Value>>) -> Vec<String> {
    let args = match args {
        Some(a) => a,
        None => return Vec::new(),
    };

    args.iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect()
}

fn maven_name_to_path(name: &str) -> String {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return name.to_string();
    }

    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];

    if parts.len() >= 4 {
        let classifier = parts[3];
        format!("{group}/{artifact}/{version}/{artifact}-{version}-{classifier}.jar")
    } else {
        format!("{group}/{artifact}/{version}/{artifact}-{version}.jar")
    }
}
