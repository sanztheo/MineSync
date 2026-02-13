use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

use crate::errors::{AppError, AppResult};
use crate::services::p2p::{P2pService, P2pStatus};

/// Tauri-managed state wrapping the P2P service.
/// `Option` because P2P starts/stops dynamically.
pub type P2pState = Arc<Mutex<Option<P2pService>>>;

#[tauri::command]
pub async fn start_p2p(
    p2p_state: tauri::State<'_, P2pState>,
    app_handle: tauri::AppHandle,
) -> AppResult<P2pStatus> {
    let mut guard = p2p_state.lock().await;

    if let Some(ref service) = *guard {
        if service.is_running() {
            return Ok(service.status());
        }
    }

    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::P2p(format!("Failed to get app data dir: {e}")))?;

    let service = P2pService::start(app_dir).await?;
    let status = service.status();
    *guard = Some(service);

    Ok(status)
}

#[tauri::command]
pub async fn stop_p2p(
    p2p_state: tauri::State<'_, P2pState>,
) -> AppResult<()> {
    let mut guard = p2p_state.lock().await;

    if let Some(ref service) = *guard {
        service.stop().await?;
    }

    *guard = None;
    Ok(())
}

#[tauri::command]
pub async fn get_p2p_status(
    p2p_state: tauri::State<'_, P2pState>,
) -> AppResult<P2pStatus> {
    let guard = p2p_state.lock().await;

    match *guard {
        Some(ref service) => Ok(service.status()),
        None => Ok(P2pStatus {
            is_running: false,
            peer_id: String::new(),
        }),
    }
}

#[tauri::command]
pub async fn share_modpack(
    p2p_state: tauri::State<'_, P2pState>,
    db: tauri::State<'_, crate::services::database::DatabaseService>,
    instance_id: String,
) -> AppResult<String> {
    let guard = p2p_state.lock().await;

    let service = guard
        .as_ref()
        .ok_or_else(|| AppError::P2p("P2P service is not running".to_string()))?;

    // Build manifest from instance data
    let instance = db
        .get_instance(&instance_id)?
        .ok_or_else(|| AppError::Custom(format!("Instance not found: {instance_id}")))?;

    let mods = db.list_instance_mods(&instance_id)?;

    let manifest = crate::models::sync::SyncManifest {
        id: uuid::Uuid::new_v4().to_string(),
        name: instance.name.clone(),
        instance_id: instance.id,
        minecraft_version: instance.minecraft_version,
        loader_type: match instance.loader {
            crate::models::instance::ModLoader::Vanilla => None,
            ref l => Some(l.to_string()),
        },
        loader_version: instance.loader_version,
        mods: mods
            .into_iter()
            .map(|m| crate::models::sync::SyncModEntry {
                mod_name: m.name,
                mod_version: m.version,
                file_name: m.file_name,
                file_hash: m.file_hash,
                source: m.source.to_string(),
                source_project_id: m.source_project_id,
                source_version_id: m.source_version_id,
            })
            .collect(),
        manifest_version: 1,
        created_at: chrono::Utc::now(),
    };

    service.share_modpack(manifest).await
}

#[tauri::command]
pub async fn join_via_code(
    p2p_state: tauri::State<'_, P2pState>,
    code: String,
) -> AppResult<()> {
    let guard = p2p_state.lock().await;

    let service = guard
        .as_ref()
        .ok_or_else(|| AppError::P2p("P2P service is not running".to_string()))?;

    service.join_via_code(&code).await
}
