use crate::errors::{AppError, AppResult};
use crate::models::instance::ModLoader;
use crate::models::launch::{GameStatus, LaunchInfo};
use crate::services::database::DatabaseService;
use crate::services::launch::LaunchService;
use crate::services::loader::LoaderService;
use crate::services::minecraft::MinecraftService;

#[tauri::command]
pub async fn launch_instance(
    launch_svc: tauri::State<'_, LaunchService>,
    mc_svc: tauri::State<'_, MinecraftService>,
    loader_svc: tauri::State<'_, LoaderService>,
    db: tauri::State<'_, DatabaseService>,
    instance_id: String,
    java_path: String,
) -> AppResult<LaunchInfo> {
    // Fetch instance from DB
    let instance = db
        .get_instance(&instance_id)?
        .ok_or_else(|| AppError::Custom(format!("Instance not found: {instance_id}")))?;

    // Fetch account (need auth token for Minecraft)
    let account = db
        .get_active_account()?
        .ok_or_else(|| AppError::Custom("No active account. Please log in first.".to_string()))?;

    // Fetch version detail (needs cached manifest)
    let version_detail = mc_svc
        .fetch_version_detail(&instance.minecraft_version)
        .await?;

    // Install loader if needed
    let loader_profile = if instance.loader != ModLoader::Vanilla {
        let loader_version = instance.loader_version.as_deref().ok_or_else(|| {
            AppError::Custom(format!(
                "Instance {} has loader {:?} but no loader_version set",
                instance_id, instance.loader
            ))
        })?;

        let profile = loader_svc
            .install_loader(&instance.loader, &instance.minecraft_version, loader_version)
            .await?;

        Some(profile)
    } else {
        None
    };

    // Launch
    launch_svc
        .launch(
            &instance_id,
            &instance.instance_path,
            &version_detail,
            loader_profile.as_ref(),
            &account,
            &java_path,
        )
        .await
}

#[tauri::command]
pub fn get_game_status(
    launch_svc: tauri::State<'_, LaunchService>,
) -> AppResult<GameStatus> {
    launch_svc.status()
}
