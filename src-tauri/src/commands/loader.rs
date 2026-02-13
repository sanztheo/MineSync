use crate::errors::AppResult;
use crate::models::instance::ModLoader;
use crate::models::loader::{LoaderProfile, LoaderVersionEntry};
use crate::services::loader::LoaderService;

#[tauri::command]
pub async fn list_loader_versions(
    loader_svc: tauri::State<'_, LoaderService>,
    loader: ModLoader,
    game_version: String,
) -> AppResult<Vec<LoaderVersionEntry>> {
    loader_svc.list_versions(&loader, &game_version).await
}

#[tauri::command]
pub async fn install_loader(
    loader_svc: tauri::State<'_, LoaderService>,
    loader: ModLoader,
    game_version: String,
    loader_version: String,
) -> AppResult<LoaderProfile> {
    loader_svc
        .install_loader(&loader, &game_version, &loader_version)
        .await
}
