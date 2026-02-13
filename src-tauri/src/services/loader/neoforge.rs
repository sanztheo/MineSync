use std::io::Read as _;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use crate::errors::{AppError, AppResult};
use crate::models::loader::{LoaderLibrary, LoaderProfile, LoaderVersionEntry};

const MAVEN_URL: &str = "https://maven.neoforged.net";
const VERSIONS_API: &str =
    "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";

pub struct NeoForgeInstaller {
    client: reqwest::Client,
}

// --- NeoForge Maven API response ---

#[derive(Deserialize)]
struct NeoForgeVersionsResponse {
    versions: Vec<String>,
}

/// The `version.json` extracted from the NeoForge installer JAR.
///
/// Contains the mainClass and libraries needed for the modded launch.
#[derive(Deserialize)]
struct NeoForgeVersionJson {
    #[serde(rename = "mainClass")]
    main_class: String,
    libraries: Vec<NeoForgeLibrary>,
    arguments: Option<NeoForgeArguments>,
}

#[derive(Deserialize)]
struct NeoForgeLibrary {
    name: String,
    downloads: Option<NeoForgeLibDownloads>,
}

#[derive(Deserialize)]
struct NeoForgeLibDownloads {
    artifact: Option<NeoForgeArtifact>,
}

#[derive(Deserialize)]
struct NeoForgeArtifact {
    path: String,
    url: String,
    sha1: Option<String>,
    size: u64,
}

#[derive(Deserialize)]
struct NeoForgeArguments {
    game: Option<Vec<serde_json::Value>>,
    jvm: Option<Vec<serde_json::Value>>,
}

impl NeoForgeInstaller {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("MineSync/1.0.0")
            .build()
            .unwrap_or_default();

        Self { client }
    }

    /// List all NeoForge versions, filtered for a specific MC version.
    ///
    /// NeoForge version scheme: MC versions map to NeoForge major.minor:
    /// MC 1.21.5 → NeoForge 21.5.x, MC 1.20.1 → NeoForge 20.1.x
    pub async fn list_versions(&self, game_version: &str) -> AppResult<Vec<LoaderVersionEntry>> {
        let response = self.client.get(VERSIONS_API).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "NeoForge Maven API failed: HTTP {}",
                response.status()
            )));
        }

        let data: NeoForgeVersionsResponse = response.json().await?;
        let prefix = mc_to_neoforge_prefix(game_version);

        let versions = data
            .versions
            .into_iter()
            .rev() // Maven returns oldest first; we want newest first
            .filter(|v| v.starts_with(&prefix))
            .map(|v| {
                let stable = !v.contains("beta") && !v.contains("alpha") && !v.contains("snapshot");
                LoaderVersionEntry {
                    loader_version: v,
                    game_version: game_version.to_string(),
                    stable,
                }
            })
            .collect();

        Ok(versions)
    }

    /// Install NeoForge by downloading the installer JAR and extracting the version profile.
    ///
    /// Steps:
    /// 1. Download the installer JAR to a temp location
    /// 2. Extract `version.json` from the JAR (it's a ZIP archive)
    /// 3. Parse the version JSON to get mainClass, libraries, arguments
    /// 4. Return a `LoaderProfile` for launch-time merging
    pub async fn install(
        &self,
        game_version: &str,
        loader_version: &str,
        base_dir: &Path,
    ) -> AppResult<LoaderProfile> {
        // Download installer JAR
        let installer_url = format!(
            "{MAVEN_URL}/releases/net/neoforged/neoforge/{loader_version}/neoforge-{loader_version}-installer.jar"
        );

        let response = self.client.get(&installer_url).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "NeoForge installer download failed for {loader_version}: HTTP {}",
                response.status()
            )));
        }

        let installer_bytes = response.bytes().await?;

        // Save installer to disk for potential future processor execution
        let loader_dir = base_dir
            .join("loaders")
            .join("neoforge")
            .join(loader_version);
        tokio::fs::create_dir_all(&loader_dir).await?;

        let installer_path = loader_dir.join(format!("neoforge-{loader_version}-installer.jar"));
        tokio::fs::write(&installer_path, &installer_bytes).await?;

        // Extract version.json from the JAR (ZIP)
        let version_json = extract_version_json_from_jar(&installer_bytes)?;

        // Save extracted version.json for reference
        let version_json_path = loader_dir.join("version.json");
        tokio::fs::write(&version_json_path, &version_json).await?;

        // Parse and convert
        let profile: NeoForgeVersionJson =
            serde_json::from_str(&version_json).map_err(|e| {
                AppError::Custom(format!(
                    "Failed to parse NeoForge version.json for {loader_version}: {e}"
                ))
            })?;

        Ok(neoforge_profile_to_loader_profile(
            profile,
            game_version,
            loader_version,
            &loader_dir,
        ))
    }

    /// Get the path to a previously downloaded installer JAR.
    pub fn installer_path(base_dir: &Path, loader_version: &str) -> PathBuf {
        base_dir
            .join("loaders")
            .join("neoforge")
            .join(loader_version)
            .join(format!("neoforge-{loader_version}-installer.jar"))
    }
}

// --- Helpers ---

/// Convert a MC version to the NeoForge version prefix.
///
/// MC 1.21.5 → "21.5.", MC 1.20.1 → "20.1.", MC 1.20 → "20.0."
fn mc_to_neoforge_prefix(game_version: &str) -> String {
    let parts: Vec<&str> = game_version.split('.').collect();
    if parts.len() >= 3 {
        // 1.21.5 → "21.5."
        format!("{}.{}.", parts[1], parts[2])
    } else if parts.len() == 2 {
        // 1.20 → "20.0."
        format!("{}.0.", parts[1])
    } else {
        game_version.to_string()
    }
}

/// Extract `version.json` from a NeoForge installer JAR (ZIP archive).
fn extract_version_json_from_jar(jar_bytes: &[u8]) -> AppResult<String> {
    let cursor = std::io::Cursor::new(jar_bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| {
        AppError::Custom(format!("Failed to open NeoForge installer as ZIP: {e}"))
    })?;

    let mut file = archive.by_name("version.json").map_err(|e| {
        AppError::Custom(format!(
            "version.json not found in NeoForge installer: {e}"
        ))
    })?;

    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

fn neoforge_profile_to_loader_profile(
    profile: NeoForgeVersionJson,
    _game_version: &str,
    _loader_version: &str,
    _loader_dir: &Path,
) -> LoaderProfile {
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
                    let url = format!(
                        "{MAVEN_URL}/releases/{path}"
                    );
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

    let game_arguments = extract_string_args(
        profile.arguments.as_ref().and_then(|a| a.game.as_ref()),
    );
    let jvm_arguments = extract_string_args(
        profile.arguments.as_ref().and_then(|a| a.jvm.as_ref()),
    );

    LoaderProfile {
        main_class: profile.main_class,
        libraries,
        game_arguments,
        jvm_arguments,
    }
}

/// Extract string arguments from a mixed array (strings + conditional objects).
/// Only plain string arguments are kept; conditional objects are skipped for now.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mc_to_neoforge_prefix() {
        assert_eq!(mc_to_neoforge_prefix("1.21.5"), "21.5.");
        assert_eq!(mc_to_neoforge_prefix("1.20.1"), "20.1.");
        assert_eq!(mc_to_neoforge_prefix("1.20"), "20.0.");
    }
}
