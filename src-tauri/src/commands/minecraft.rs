use crate::errors::{AppError, AppResult};
use crate::services::download::{DownloadProgress, DownloadService};
use crate::services::minecraft::{MinecraftService, VersionEntry};

#[tauri::command]
pub async fn list_mc_versions(
    mc: tauri::State<'_, MinecraftService>,
) -> AppResult<Vec<VersionEntry>> {
    mc.fetch_version_manifest().await
}

#[tauri::command]
pub async fn download_version(
    mc: tauri::State<'_, MinecraftService>,
    dl: tauri::State<'_, DownloadService>,
    version_id: String,
) -> AppResult<()> {
    if dl.is_downloading()? {
        return Err(AppError::Custom(
            "A download is already in progress".to_string(),
        ));
    }

    let detail = mc.fetch_version_detail(&version_id).await?;
    let tasks = mc.resolve_downloads(&detail).await?;

    // Run downloads in background so the command returns immediately
    let dl_clone = DownloadService::clone(&*dl);
    let vid = version_id.clone();
    tokio::spawn(async move {
        if let Err(e) = dl_clone.download_all(tasks).await {
            log::error!("Download failed for version {vid}: {e}");
        }
    });

    Ok(())
}

#[tauri::command]
pub fn get_download_progress(
    dl: tauri::State<'_, DownloadService>,
) -> AppResult<DownloadProgress> {
    dl.get_progress()
}
