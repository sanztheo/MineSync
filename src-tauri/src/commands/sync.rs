use crate::errors::{AppError, AppResult};
use crate::models::sync::{SyncSession, SyncStatus};
use crate::services::database::DatabaseService;

#[tauri::command]
pub fn create_sync_session(
    db: tauri::State<'_, DatabaseService>,
    instance_id: String,
) -> AppResult<SyncSession> {
    if db.get_instance(&instance_id)?.is_none() {
        return Err(AppError::Custom(format!(
            "Instance not found: {instance_id}"
        )));
    }

    let now = chrono::Utc::now();
    let session = SyncSession {
        id: uuid::Uuid::new_v4().to_string(),
        instance_id,
        share_code: Some(generate_share_code()),
        peer_id: None,
        is_host: true,
        status: SyncStatus::Inactive,
        created_at: now,
        updated_at: now,
    };

    db.create_sync_session(&session)?;
    Ok(session)
}

#[tauri::command]
pub fn join_sync_session(
    db: tauri::State<'_, DatabaseService>,
    sync_code: String,
) -> AppResult<SyncSession> {
    db.get_sync_session_by_code(&sync_code)?.ok_or_else(|| {
        AppError::Custom(format!("No session found with code: {sync_code}"))
    })
}

/// Generate a 6-character uppercase alphanumeric share code
fn generate_share_code() -> String {
    uuid::Uuid::new_v4()
        .to_string()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .take(6)
        .collect::<String>()
        .to_uppercase()
}
