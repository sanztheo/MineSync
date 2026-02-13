use crate::errors::AppResult;
use crate::models::mod_info::{ModInfo, ModSource};
use crate::models::sync::SyncModEntry;
use crate::services::database::DatabaseService;
use crate::services::sync_protocol::manifest_diff::{ManifestDiff, ModUpdate};

/// Result of applying a diff to an instance.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ApplyResult {
    pub mods_added: Vec<String>,
    pub mods_removed: Vec<String>,
    pub mods_updated: Vec<String>,
    pub errors: Vec<String>,
}

/// Apply a ManifestDiff to a local instance.
///
/// This function:
/// 1. Removes mods that are no longer in the remote manifest
/// 2. Adds new mods to the DB (files will be downloaded separately by the frontend)
/// 3. Updates changed mods (remove old, add new version)
///
/// File downloads are NOT handled here — the frontend triggers downloads
/// via the mod platform APIs using the source_project_id/source_version_id.
pub fn apply_diff(
    db: &DatabaseService,
    instance_id: &str,
    diff: &ManifestDiff,
) -> AppResult<ApplyResult> {
    let mut result = ApplyResult {
        mods_added: Vec::new(),
        mods_removed: Vec::new(),
        mods_updated: Vec::new(),
        errors: Vec::new(),
    };

    // Step 1: Remove mods not in remote
    apply_removals(db, instance_id, &diff.to_remove, &mut result);

    // Step 2: Add new mods from remote
    apply_additions(db, instance_id, &diff.to_add, &mut result);

    // Step 3: Update changed mods (remove old version, add new)
    apply_updates(db, instance_id, &diff.to_update, &mut result);

    Ok(result)
}

fn apply_removals(
    db: &DatabaseService,
    instance_id: &str,
    to_remove: &[SyncModEntry],
    result: &mut ApplyResult,
) {
    let existing_mods = match db.list_instance_mods(instance_id) {
        Ok(mods) => mods,
        Err(e) => {
            result.errors.push(format!("Failed to list mods: {e}"));
            return;
        }
    };

    for entry in to_remove {
        let found = existing_mods.iter().find(|m| m.name == entry.mod_name);

        if let Some(mod_info) = found {
            match db.remove_mod_from_instance(&mod_info.id) {
                Ok(()) => result.mods_removed.push(entry.mod_name.clone()),
                Err(e) => result
                    .errors
                    .push(format!("Failed to remove mod '{}': {e}", entry.mod_name)),
            }
        }
    }
}

fn apply_additions(
    db: &DatabaseService,
    instance_id: &str,
    to_add: &[SyncModEntry],
    result: &mut ApplyResult,
) {
    for entry in to_add {
        let source = entry
            .source
            .parse::<ModSource>()
            .unwrap_or(ModSource::Local);

        let mod_info = ModInfo {
            id: uuid::Uuid::new_v4().to_string(),
            instance_id: instance_id.to_string(),
            name: entry.mod_name.clone(),
            slug: None,
            version: entry.mod_version.clone(),
            file_name: entry.file_name.clone(),
            file_hash: entry.file_hash.clone(),
            source,
            source_project_id: entry.source_project_id.clone(),
            source_version_id: entry.source_version_id.clone(),
            is_active: true,
            installed_at: chrono::Utc::now(),
        };

        match db.add_mod_to_instance(&mod_info) {
            Ok(()) => result.mods_added.push(entry.mod_name.clone()),
            Err(e) => result
                .errors
                .push(format!("Failed to add mod '{}': {e}", entry.mod_name)),
        }
    }
}

fn apply_updates(
    db: &DatabaseService,
    instance_id: &str,
    to_update: &[ModUpdate],
    result: &mut ApplyResult,
) {
    let existing_mods = match db.list_instance_mods(instance_id) {
        Ok(mods) => mods,
        Err(e) => {
            result
                .errors
                .push(format!("Failed to list mods for update: {e}"));
            return;
        }
    };

    for update in to_update {
        // Remove old version
        let found = existing_mods.iter().find(|m| m.name == update.mod_name);

        if let Some(old_mod) = found {
            if let Err(e) = db.remove_mod_from_instance(&old_mod.id) {
                result.errors.push(format!(
                    "Failed to remove old version of '{}': {e}",
                    update.mod_name
                ));
                continue;
            }
        }

        // Add new version
        let source = update
            .source
            .parse::<ModSource>()
            .unwrap_or(ModSource::Local);

        let mod_info = ModInfo {
            id: uuid::Uuid::new_v4().to_string(),
            instance_id: instance_id.to_string(),
            name: update.mod_name.clone(),
            slug: None,
            version: update.remote_version.clone(),
            file_name: update.remote_file_name.clone(),
            file_hash: update.remote_hash.clone(),
            source,
            source_project_id: update.source_project_id.clone(),
            source_version_id: update.source_version_id.clone(),
            is_active: true,
            installed_at: chrono::Utc::now(),
        };

        match db.add_mod_to_instance(&mod_info) {
            Ok(()) => result.mods_updated.push(update.mod_name.clone()),
            Err(e) => result.errors.push(format!(
                "Failed to add updated mod '{}': {e}",
                update.mod_name
            )),
        }
    }
}
