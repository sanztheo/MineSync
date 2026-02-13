use crate::errors::AppResult;
use crate::models::install::InstallProgress;
use crate::models::instance::MinecraftInstance;
use crate::models::mod_info::{ModInfo, ModSource};
use crate::services::database::DatabaseService;
use crate::services::download::DownloadService;
use crate::services::install::InstallService;
use crate::services::loader::LoaderService;
use crate::services::minecraft::MinecraftService;
use crate::services::mod_platform::UnifiedModClient;

#[tauri::command]
pub async fn install_mod(
    install_service: tauri::State<'_, InstallService>,
    mod_client: tauri::State<'_, UnifiedModClient>,
    download_service: tauri::State<'_, DownloadService>,
    db: tauri::State<'_, DatabaseService>,
    instance_id: String,
    source: ModSource,
    project_id: String,
    version_id: String,
) -> AppResult<ModInfo> {
    install_service
        .install_mod(
            &db,
            &mod_client,
            &download_service,
            &instance_id,
            &source,
            &project_id,
            &version_id,
        )
        .await
}

#[tauri::command]
pub async fn install_modpack(
    install_service: tauri::State<'_, InstallService>,
    mod_client: tauri::State<'_, UnifiedModClient>,
    download_service: tauri::State<'_, DownloadService>,
    mc_service: tauri::State<'_, MinecraftService>,
    loader_service: tauri::State<'_, LoaderService>,
    db: tauri::State<'_, DatabaseService>,
    source: ModSource,
    project_id: String,
    version_id: String,
    modpack_name: Option<String>,
    modpack_icon_url: Option<String>,
    modpack_description: Option<String>,
) -> AppResult<MinecraftInstance> {
    install_service
        .install_modpack(
            &db,
            &mod_client,
            &download_service,
            &mc_service,
            &loader_service,
            &source,
            &project_id,
            &version_id,
            modpack_name,
            modpack_icon_url,
            modpack_description,
        )
        .await
}

#[tauri::command]
pub fn get_install_progress(
    install_service: tauri::State<'_, InstallService>,
) -> AppResult<InstallProgress> {
    install_service.get_progress()
}

#[tauri::command]
pub fn list_instance_mods(
    db: tauri::State<'_, DatabaseService>,
    instance_id: String,
) -> AppResult<Vec<ModInfo>> {
    db.list_instance_mods(&instance_id)
}

#[tauri::command]
pub fn remove_mod(
    install_service: tauri::State<'_, InstallService>,
    db: tauri::State<'_, DatabaseService>,
    mod_id: String,
) -> AppResult<()> {
    install_service.remove_mod(&db, &mod_id)
}
