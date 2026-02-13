use crate::errors::{AppError, AppResult};
use crate::models::sync::SyncManifest;
use crate::services::sync_protocol::{ManifestDiff, PendingSync, SyncProtocolService};

/// Preview a diff between a local instance and a received remote manifest.
///
/// Called when the joiner receives a manifest from the host.
/// Creates a pending sync and returns the diff for user review.
#[tauri::command]
pub fn preview_sync(
    sync_service: tauri::State<'_, SyncProtocolService>,
    db: tauri::State<'_, crate::services::database::DatabaseService>,
    remote_peer_id: String,
    instance_id: String,
    remote_manifest: SyncManifest,
) -> AppResult<PreviewSyncResponse> {
    let instance = db
        .get_instance(&instance_id)?
        .ok_or_else(|| AppError::Custom(format!("Instance not found: {instance_id}")))?;

    let mods = db.list_instance_mods(&instance_id)?;

    let local_manifest = SyncManifest {
        instance_id: instance.id,
        minecraft_version: instance.minecraft_version,
        loader: instance.loader.to_string(),
        loader_version: instance.loader_version,
        mods: mods
            .into_iter()
            .map(|m| crate::models::sync::SyncModEntry {
                name: m.name,
                version: m.version,
                source: m.source.to_string(),
                source_id: m.source_project_id,
                file_hash: m.file_hash,
            })
            .collect(),
        created_at: chrono::Utc::now(),
    };

    let (session_id, diff) = sync_service.create_pending_sync(
        remote_peer_id,
        local_manifest,
        remote_manifest,
    )?;

    Ok(PreviewSyncResponse { session_id, diff })
}

#[derive(serde::Serialize)]
pub struct PreviewSyncResponse {
    pub session_id: String,
    pub diff: ManifestDiff,
}

/// Get details of a pending sync session.
#[tauri::command]
pub fn get_pending_sync(
    sync_service: tauri::State<'_, SyncProtocolService>,
    session_id: String,
) -> AppResult<Option<PendingSync>> {
    sync_service.get_pending_sync(&session_id)
}

/// User confirms the sync — returns the diff to apply.
///
/// After confirmation, the frontend should trigger mod downloads
/// based on the returned diff (to_add, to_update) and remove
/// mods listed in to_remove.
#[tauri::command]
pub fn confirm_sync(
    sync_service: tauri::State<'_, SyncProtocolService>,
    session_id: String,
) -> AppResult<ManifestDiff> {
    sync_service.confirm_sync(&session_id)
}

/// User rejects the sync.
#[tauri::command]
pub fn reject_sync(
    sync_service: tauri::State<'_, SyncProtocolService>,
    session_id: String,
) -> AppResult<()> {
    sync_service.reject_sync(&session_id)
}

/// Mark sync as completed (called after mods are downloaded/removed).
#[tauri::command]
pub fn complete_sync(
    sync_service: tauri::State<'_, SyncProtocolService>,
    session_id: String,
) -> AppResult<()> {
    sync_service.complete_sync(&session_id)
}

/// Compute a diff between two manifests without creating a pending sync.
///
/// Useful for dry-run or display in UI before connecting.
#[tauri::command]
pub fn compute_manifest_diff(
    local_manifest: SyncManifest,
    remote_manifest: SyncManifest,
) -> AppResult<ManifestDiff> {
    Ok(crate::services::sync_protocol::compute_diff(
        &local_manifest,
        &remote_manifest,
    ))
}
