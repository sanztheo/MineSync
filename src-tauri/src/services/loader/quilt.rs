use serde::Deserialize;

use crate::errors::{AppError, AppResult};
use crate::models::loader::{LoaderLibrary, LoaderProfile, LoaderVersionEntry};

const META_URL: &str = "https://meta.quiltmc.org/v3";

pub struct QuiltInstaller {
    client: reqwest::Client,
}

// --- Quilt Meta API response types ---

#[derive(Deserialize)]
struct QuiltLoaderEntry {
    loader: QuiltLoaderVersion,
}

#[derive(Deserialize)]
struct QuiltLoaderVersion {
    version: String,
}

/// Quilt profile JSON — same structure as Fabric's.
#[derive(Deserialize)]
struct QuiltProfileJson {
    #[serde(rename = "mainClass")]
    main_class: String,
    libraries: Vec<QuiltLibrary>,
    arguments: Option<QuiltArguments>,
}

#[derive(Deserialize)]
struct QuiltLibrary {
    name: String,
    url: Option<String>,
}

#[derive(Deserialize)]
struct QuiltArguments {
    game: Option<Vec<String>>,
    jvm: Option<Vec<String>>,
}

impl QuiltInstaller {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("MineSync/1.0.0")
            .build()
            .unwrap_or_default();

        Self { client }
    }

    /// List all Quilt loader versions available for a Minecraft version.
    pub async fn list_versions(&self, game_version: &str) -> AppResult<Vec<LoaderVersionEntry>> {
        let url = format!("{META_URL}/versions/loader/{game_version}");
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "Quilt Meta API failed for {game_version}: HTTP {}",
                response.status()
            )));
        }

        let entries: Vec<QuiltLoaderEntry> = response.json().await?;

        let versions = entries
            .into_iter()
            .map(|e| LoaderVersionEntry {
                loader_version: e.loader.version,
                game_version: game_version.to_string(),
                stable: true, // Quilt API doesn't expose a stable flag
            })
            .collect();

        Ok(versions)
    }

    /// Install Quilt by fetching the profile JSON.
    ///
    /// Same approach as Fabric — the profile endpoint returns a complete
    /// launcher profile that we convert to a `LoaderProfile`.
    pub async fn install(
        &self,
        game_version: &str,
        loader_version: &str,
    ) -> AppResult<LoaderProfile> {
        let url =
            format!("{META_URL}/versions/loader/{game_version}/{loader_version}/profile/json");

        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "Quilt profile fetch failed for {game_version}/{loader_version}: HTTP {}",
                response.status()
            )));
        }

        let profile: QuiltProfileJson = response.json().await?;
        Ok(quilt_profile_to_loader_profile(profile))
    }
}

// --- Converters ---

fn quilt_profile_to_loader_profile(profile: QuiltProfileJson) -> LoaderProfile {
    let libraries = profile
        .libraries
        .into_iter()
        .map(|lib| {
            let path = maven_name_to_path(&lib.name);
            let base_url = lib
                .url
                .unwrap_or_else(|| "https://maven.quiltmc.org/repository/release/".to_string());
            let url = format!("{}{}", base_url.trim_end_matches('/'), &format!("/{path}"));

            LoaderLibrary {
                name: lib.name,
                url,
                path,
                sha1: None,
                size: 0,
            }
        })
        .collect();

    let (game_arguments, jvm_arguments) = match profile.arguments {
        Some(args) => (args.game.unwrap_or_default(), args.jvm.unwrap_or_default()),
        None => (Vec::new(), Vec::new()),
    };

    LoaderProfile {
        main_class: profile.main_class,
        libraries,
        game_arguments,
        jvm_arguments,
    }
}

/// Convert a Maven coordinate to a file path (same logic as Fabric).
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
