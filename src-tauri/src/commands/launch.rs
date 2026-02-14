use crate::errors::{AppError, AppResult};
use crate::models::instance::ModLoader;
use crate::models::launch::{CrashLog, GameStatus, LaunchInfo};
use crate::services::database::DatabaseService;
use crate::services::download::DownloadService;
use crate::services::java::JavaService;
use crate::services::launch::LaunchService;
use crate::services::loader::LoaderService;
use crate::services::minecraft::MinecraftService;

#[tauri::command]
pub async fn launch_instance(
    launch_svc: tauri::State<'_, LaunchService>,
    mc_svc: tauri::State<'_, MinecraftService>,
    loader_svc: tauri::State<'_, LoaderService>,
    download_svc: tauri::State<'_, DownloadService>,
    java_svc: tauri::State<'_, JavaService>,
    db: tauri::State<'_, DatabaseService>,
    app_handle: tauri::AppHandle,
    instance_id: String,
    java_path: Option<String>,
) -> AppResult<LaunchInfo> {
    // Fetch instance from DB
    let instance = db
        .get_instance(&instance_id)?
        .ok_or_else(|| AppError::Custom(format!("Instance not found: {instance_id}")))?;

    // Fetch account (need auth token for Minecraft)
    let account = db
        .get_active_account()?
        .ok_or_else(|| AppError::Custom("No active account. Please log in first.".to_string()))?;

    // Auto-detect Java if not provided
    let java = match java_path {
        Some(ref p) if !p.is_empty() => p.clone(),
        _ => java_svc.get_java_path().await?,
    };

    // Fetch version detail (needs cached manifest)
    let version_detail = mc_svc
        .fetch_version_detail(&instance.minecraft_version)
        .await?;

    // Install loader if needed + download loader libraries
    let loader_profile = if instance.loader != ModLoader::Vanilla {
        let loader_version = instance.loader_version.as_deref().ok_or_else(|| {
            AppError::Custom(format!(
                "Instance {} has loader {:?} but no loader_version set",
                instance_id, instance.loader
            ))
        })?;

        let profile = loader_svc
            .install_loader(
                &instance.loader,
                &instance.minecraft_version,
                loader_version,
            )
            .await?;

        // Download loader library JARs that are missing from disk
        loader_svc
            .download_loader_libraries(&profile, &download_svc)
            .await?;

        Some(profile)
    } else {
        None
    };

    // Launch (handles P2P stop, process monitoring, play time tracking)
    launch_svc
        .launch(
            &instance_id,
            &instance.instance_path,
            &version_detail,
            loader_profile.as_ref(),
            &account,
            &java,
            app_handle,
        )
        .await
}

#[tauri::command]
pub fn get_game_status(launch_svc: tauri::State<'_, LaunchService>) -> AppResult<GameStatus> {
    launch_svc.status()
}

#[tauri::command]
pub fn kill_game(launch_svc: tauri::State<'_, LaunchService>) -> AppResult<()> {
    launch_svc.kill_game()
}

#[tauri::command]
pub fn get_crash_log(
    launch_svc: tauri::State<'_, LaunchService>,
) -> AppResult<Option<CrashLog>> {
    launch_svc.get_crash_log()
}

#[tauri::command]
pub fn clear_crash_log(launch_svc: tauri::State<'_, LaunchService>) -> AppResult<()> {
    launch_svc.clear_crash_log()
}
