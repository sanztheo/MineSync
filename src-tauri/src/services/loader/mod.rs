pub mod fabric;
pub mod forge;
pub mod neoforge;
pub mod quilt;

use std::path::PathBuf;

use crate::errors::{AppError, AppResult};
use crate::models::instance::ModLoader;
use crate::models::loader::{LoaderProfile, LoaderVersionEntry};

use self::fabric::FabricInstaller;
use self::forge::ForgeInstaller;
use self::neoforge::NeoForgeInstaller;
use self::quilt::QuiltInstaller;

/// Unified loader service that dispatches to the correct installer
/// based on the `ModLoader` enum.
pub struct LoaderService {
    fabric: FabricInstaller,
    quilt: QuiltInstaller,
    forge: ForgeInstaller,
    neoforge: NeoForgeInstaller,
    base_dir: PathBuf,
}

impl LoaderService {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            fabric: FabricInstaller::new(),
            quilt: QuiltInstaller::new(),
            forge: ForgeInstaller::new(),
            neoforge: NeoForgeInstaller::new(),
            base_dir,
        }
    }

    /// List available loader versions for a Minecraft version.
    pub async fn list_versions(
        &self,
        loader: &ModLoader,
        game_version: &str,
    ) -> AppResult<Vec<LoaderVersionEntry>> {
        match loader {
            ModLoader::Fabric => self.fabric.list_versions(game_version).await,
            ModLoader::Quilt => self.quilt.list_versions(game_version).await,
            ModLoader::Forge => self.forge.list_versions(game_version).await,
            ModLoader::NeoForge => self.neoforge.list_versions(game_version).await,
            ModLoader::Vanilla => Err(AppError::Custom(
                "Vanilla does not have loader versions".to_string(),
            )),
        }
    }

    /// Install a loader for a specific Minecraft version.
    ///
    /// Returns a `LoaderProfile` containing the modified mainClass,
    /// additional libraries, and extra arguments that must be merged
    /// with the vanilla launch configuration.
    pub async fn install_loader(
        &self,
        loader: &ModLoader,
        game_version: &str,
        loader_version: &str,
    ) -> AppResult<LoaderProfile> {
        match loader {
            ModLoader::Fabric => {
                self.fabric.install(game_version, loader_version).await
            }
            ModLoader::Quilt => {
                self.quilt.install(game_version, loader_version).await
            }
            ModLoader::Forge => {
                self.forge
                    .install(game_version, loader_version, &self.base_dir)
                    .await
            }
            ModLoader::NeoForge => {
                self.neoforge
                    .install(game_version, loader_version, &self.base_dir)
                    .await
            }
            ModLoader::Vanilla => Err(AppError::Custom(
                "Vanilla does not require loader installation".to_string(),
            )),
        }
    }
}
