use serde::{Deserialize, Serialize};

/// A version of a mod loader available for a specific Minecraft version.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderVersionEntry {
    pub loader_version: String,
    pub game_version: String,
    pub stable: bool,
}

/// The result of installing a mod loader.
///
/// Contains everything needed to modify the launch command:
/// the new main class, additional libraries for the classpath,
/// and extra JVM/game arguments.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderProfile {
    pub main_class: String,
    pub libraries: Vec<LoaderLibrary>,
    pub game_arguments: Vec<String>,
    pub jvm_arguments: Vec<String>,
}

/// A library required by the mod loader.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderLibrary {
    pub name: String,
    pub url: String,
    pub path: String,
    pub sha1: Option<String>,
    pub size: u64,
}
