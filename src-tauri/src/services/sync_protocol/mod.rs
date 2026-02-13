pub mod apply_diff;
pub mod manifest_diff;

pub use apply_diff::{apply_diff, ApplyResult};
pub use manifest_diff::{compute_diff, ManifestDiff};

use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::errors::{AppError, AppResult};
use crate::models::sync::SyncManifest;

/// Unique session identifier for a pending sync operation.
type SessionId = String;

/// A pending sync awaiting user confirmation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingSync {
    pub session_id: String,
    pub remote_peer_id: String,
    pub local_manifest: SyncManifest,
    pub remote_manifest: SyncManifest,
    pub diff: ManifestDiff,
    pub status: PendingSyncStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PendingSyncStatus {
    /// Waiting for user to review the diff and confirm.
    AwaitingConfirmation,
    /// User confirmed, sync in progress.
    Syncing,
    /// Sync completed successfully.
    Completed,
    /// User rejected or sync failed.
    Rejected,
}

/// Manages the sync protocol state.
///
/// Holds pending syncs that require user confirmation before applying.
/// This enforces the "no auto-sync" rule: every sync is explicit.
pub struct SyncProtocolService {
    pending_syncs: Mutex<HashMap<SessionId, PendingSync>>,
}

impl SyncProtocolService {
    pub fn new() -> Self {
        Self {
            pending_syncs: Mutex::new(HashMap::new()),
        }
    }

    /// Create a pending sync from received remote manifest.
    ///
    /// Computes the diff and stores it for user review.
    /// Returns the session ID and diff summary.
    pub fn create_pending_sync(
        &self,
        remote_peer_id: String,
        local_manifest: SyncManifest,
        remote_manifest: SyncManifest,
    ) -> AppResult<(String, ManifestDiff)> {
        let diff = compute_diff(&local_manifest, &remote_manifest);
        let session_id = uuid::Uuid::new_v4().to_string();

        let pending = PendingSync {
            session_id: session_id.clone(),
            remote_peer_id,
            local_manifest,
            remote_manifest,
            diff: diff.clone(),
            status: PendingSyncStatus::AwaitingConfirmation,
        };

        let mut guard = self
            .pending_syncs
            .lock()
            .map_err(|e| AppError::Custom(format!("Sync state lock poisoned: {e}")))?;

        guard.insert(session_id.clone(), pending);

        Ok((session_id, diff))
    }

    /// Get a pending sync by session ID.
    pub fn get_pending_sync(&self, session_id: &str) -> AppResult<Option<PendingSync>> {
        let guard = self
            .pending_syncs
            .lock()
            .map_err(|e| AppError::Custom(format!("Sync state lock poisoned: {e}")))?;

        Ok(guard.get(session_id).cloned())
    }

    /// User confirms the sync — mark as syncing and return the diff to apply.
    pub fn confirm_sync(&self, session_id: &str) -> AppResult<ManifestDiff> {
        let mut guard = self
            .pending_syncs
            .lock()
            .map_err(|e| AppError::Custom(format!("Sync state lock poisoned: {e}")))?;

        let pending = guard
            .get_mut(session_id)
            .ok_or_else(|| AppError::Custom(format!("No pending sync found: {session_id}")))?;

        if pending.status != PendingSyncStatus::AwaitingConfirmation {
            return Err(AppError::Custom(format!(
                "Sync {session_id} is not awaiting confirmation, status: {:?}",
                pending.status
            )));
        }

        pending.status = PendingSyncStatus::Syncing;
        Ok(pending.diff.clone())
    }

    /// User rejects the sync.
    pub fn reject_sync(&self, session_id: &str) -> AppResult<()> {
        let mut guard = self
            .pending_syncs
            .lock()
            .map_err(|e| AppError::Custom(format!("Sync state lock poisoned: {e}")))?;

        let pending = guard
            .get_mut(session_id)
            .ok_or_else(|| AppError::Custom(format!("No pending sync found: {session_id}")))?;

        pending.status = PendingSyncStatus::Rejected;
        Ok(())
    }

    /// Mark a sync as completed after applying the diff.
    pub fn complete_sync(&self, session_id: &str) -> AppResult<()> {
        let mut guard = self
            .pending_syncs
            .lock()
            .map_err(|e| AppError::Custom(format!("Sync state lock poisoned: {e}")))?;

        let pending = guard
            .get_mut(session_id)
            .ok_or_else(|| AppError::Custom(format!("No pending sync found: {session_id}")))?;

        pending.status = PendingSyncStatus::Completed;
        Ok(())
    }

    /// Clean up old completed/rejected syncs.
    pub fn cleanup_finished(&self) -> AppResult<usize> {
        let mut guard = self
            .pending_syncs
            .lock()
            .map_err(|e| AppError::Custom(format!("Sync state lock poisoned: {e}")))?;

        let before = guard.len();
        guard.retain(|_, sync| {
            sync.status != PendingSyncStatus::Completed
                && sync.status != PendingSyncStatus::Rejected
        });

        Ok(before - guard.len())
    }
}
