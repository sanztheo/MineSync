use serde::Deserialize;

use crate::errors::{AppError, AppResult};
use crate::models::loader::{LoaderLibrary, LoaderProfile, LoaderVersionEntry};

const META_URL: &str = "https://meta.fabricmc.net/v2";

pub struct FabricInstaller {
    client: reqwest::Client,
}

// --- Fabric Meta API response types ---

#[derive(Deserialize)]
struct FabricLoaderEntry {
    loader: FabricLoaderVersion,
}

#[derive(Deserialize)]
struct FabricLoaderVersion {
    version: String,
    stable: bool,
}

/// Fabric profile JSON returned by the `/profile/json` endpoint.
///
/// This is a complete launcher profile — we extract mainClass,
/// libraries, and arguments from it.
#[derive(Deserialize)]
struct FabricProfileJson {
    #[serde(rename = "mainClass")]
    main_class: String,
    libraries: Vec<FabricLibrary>,
    arguments: Option<FabricArguments>,
}

#[derive(Deserialize)]
struct FabricLibrary {
    name: String,
    url: Option<String>,
}

#[derive(Deserialize)]
struct FabricArguments {
    game: Option<Vec<String>>,
    jvm: Option<Vec<String>>,
}

impl FabricInstaller {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent("MineSync/1.0.0")
            .build()
            .unwrap_or_default();

        Self { client }
    }

    /// List all Fabric loader versions available for a Minecraft version.
    pub async fn list_versions(&self, game_version: &str) -> AppResult<Vec<LoaderVersionEntry>> {
        let url = format!("{META_URL}/versions/loader/{game_version}");
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "Fabric Meta API failed for {game_version}: HTTP {}",
                response.status()
            )));
        }

        let entries: Vec<FabricLoaderEntry> = response.json().await?;

        let versions = entries
            .into_iter()
            .map(|e| LoaderVersionEntry {
                loader_version: e.loader.version,
                game_version: game_version.to_string(),
                stable: e.loader.stable,
            })
            .collect();

        Ok(versions)
    }

    /// Install Fabric by fetching the profile JSON and extracting the profile.
    ///
    /// Returns a `LoaderProfile` containing the new mainClass, libraries, and arguments
    /// that must be merged with the vanilla version at launch time.
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
                "Fabric profile fetch failed for {game_version}/{loader_version}: HTTP {}",
                response.status()
            )));
        }

        let profile: FabricProfileJson = response.json().await?;
        Ok(fabric_profile_to_loader_profile(profile))
    }
}

// --- Converters ---

fn fabric_profile_to_loader_profile(profile: FabricProfileJson) -> LoaderProfile {
    let libraries = profile
        .libraries
        .into_iter()
        .map(|lib| {
            let path = maven_name_to_path(&lib.name);
            let base_url = lib
                .url
                .unwrap_or_else(|| "https://maven.fabricmc.net/".to_string());
            let url = format!("{}{}", base_url.trim_end_matches('/'), &format!("/{path}"));

            LoaderLibrary {
                name: lib.name,
                url,
                path,
                sha1: None, // Fabric Meta doesn't provide hashes
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

/// Convert a Maven coordinate (`group:artifact:version`) to a file path.
///
/// Example: `net.fabricmc:fabric-loader:0.16.14`
/// → `net/fabricmc/fabric-loader/0.16.14/fabric-loader-0.16.14.jar`
fn maven_name_to_path(name: &str) -> String {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return name.to_string();
    }

    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];

    // Handle optional classifier (group:artifact:version:classifier)
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
    fn test_maven_name_to_path() {
        assert_eq!(
            maven_name_to_path("net.fabricmc:fabric-loader:0.16.14"),
            "net/fabricmc/fabric-loader/0.16.14/fabric-loader-0.16.14.jar"
        );
        assert_eq!(
            maven_name_to_path("org.ow2.asm:asm:9.7.1"),
            "org/ow2/asm/asm/9.7.1/asm-9.7.1.jar"
        );
    }

    #[test]
    fn test_maven_name_with_classifier() {
        assert_eq!(
            maven_name_to_path("net.fabricmc:tiny-mappings-parser:0.3.0:sources"),
            "net/fabricmc/tiny-mappings-parser/0.3.0/tiny-mappings-parser-0.3.0-sources.jar"
        );
    }
}
