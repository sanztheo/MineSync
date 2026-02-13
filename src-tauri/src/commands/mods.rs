use crate::errors::AppResult;
use crate::models::mod_info::ModSource;
use crate::models::mod_platform::{
    ContentType, ModDetails, ModVersionInfo, SearchFilters, SearchResponse,
};
use crate::services::mod_platform::UnifiedModClient;

#[tauri::command]
pub async fn search_mods(
    client: tauri::State<'_, UnifiedModClient>,
    filters: SearchFilters,
) -> AppResult<SearchResponse> {
    client.search_mods(&filters).await
}

#[tauri::command]
pub async fn search_modpacks(
    client: tauri::State<'_, UnifiedModClient>,
    filters: SearchFilters,
) -> AppResult<SearchResponse> {
    let mut filters = filters;
    filters.content_type = ContentType::Modpack;
    client.search_mods(&filters).await
}

#[tauri::command]
pub async fn get_mod_details(
    client: tauri::State<'_, UnifiedModClient>,
    source: ModSource,
    project_id: String,
) -> AppResult<ModDetails> {
    client.get_mod(&source, &project_id).await
}

#[tauri::command]
pub async fn get_mod_versions(
    client: tauri::State<'_, UnifiedModClient>,
    source: ModSource,
    project_id: String,
    game_version: Option<String>,
    loader: Option<String>,
) -> AppResult<Vec<ModVersionInfo>> {
    client
        .get_versions(
            &source,
            &project_id,
            game_version.as_deref(),
            loader.as_deref(),
        )
        .await
}

#[tauri::command]
pub async fn resolve_mod_dependencies(
    client: tauri::State<'_, UnifiedModClient>,
    source: ModSource,
    project_id: String,
    version_id: String,
    game_version: Option<String>,
    loader: Option<String>,
) -> AppResult<Vec<ModVersionInfo>> {
    // Fetch versions to find the specific one
    let versions = client
        .get_versions(
            &source,
            &project_id,
            game_version.as_deref(),
            loader.as_deref(),
        )
        .await?;

    let version = versions
        .into_iter()
        .find(|v| v.id == version_id)
        .ok_or_else(|| {
            crate::errors::AppError::Custom(format!("Version not found: {version_id}"))
        })?;

    client
        .resolve_dependencies(&version, game_version.as_deref(), loader.as_deref())
        .await
}
