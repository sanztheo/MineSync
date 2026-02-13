use crate::errors::{AppError, AppResult};
use crate::models::sync::SyncManifest;
use crate::services::sync_protocol::{
    apply_diff, ApplyResult, ManifestDiff, PendingSync, SyncProtocolService,
};

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

    let (session_id, diff) =
        sync_service.create_pending_sync(remote_peer_id, local_manifest, remote_manifest)?;

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

/// Apply a confirmed sync: updates the local DB to match the remote manifest.
///
/// Confirms the pending sync, applies additions/removals/updates to the DB,
/// then marks the sync as completed. File downloads are handled separately
/// by the frontend using the source IDs in the returned ApplyResult.
#[tauri::command]
pub fn apply_sync(
    sync_service: tauri::State<'_, SyncProtocolService>,
    db: tauri::State<'_, crate::services::database::DatabaseService>,
    session_id: String,
) -> AppResult<ApplyResult> {
    let pending = sync_service
        .get_pending_sync(&session_id)?
        .ok_or_else(|| AppError::Custom(format!("No pending sync found: {session_id}")))?;

    let diff = sync_service.confirm_sync(&session_id)?;

    let result = apply_diff(&db, &pending.local_manifest.instance_id, &diff)?;

    sync_service.complete_sync(&session_id)?;

    Ok(result)
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
