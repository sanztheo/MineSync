use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::models::sync::{SyncManifest, SyncModEntry};

/// Result of diffing two manifests: what changed between local and remote.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestDiff {
    /// Mods present in remote but missing locally.
    pub to_add: Vec<SyncModEntry>,
    /// Mods present locally but missing in remote.
    pub to_remove: Vec<SyncModEntry>,
    /// Mods present in both but with different versions/hashes.
    pub to_update: Vec<ModUpdate>,
    /// Whether the Minecraft version or loader differs.
    pub version_mismatch: Option<VersionMismatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModUpdate {
    pub mod_name: String,
    pub local_version: String,
    pub remote_version: String,
    pub source: String,
    pub source_project_id: Option<String>,
    pub source_version_id: Option<String>,
    pub remote_file_name: String,
    pub remote_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionMismatch {
    pub local_mc_version: String,
    pub remote_mc_version: String,
    pub local_loader: Option<String>,
    pub remote_loader: Option<String>,
}

impl ManifestDiff {
    pub fn is_empty(&self) -> bool {
        self.to_add.is_empty()
            && self.to_remove.is_empty()
            && self.to_update.is_empty()
            && self.version_mismatch.is_none()
    }

    pub fn summary(&self) -> DiffSummary {
        DiffSummary {
            mods_to_add: self.to_add.len() as i32,
            mods_to_remove: self.to_remove.len() as i32,
            mods_to_update: self.to_update.len() as i32,
            has_version_mismatch: self.version_mismatch.is_some(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffSummary {
    pub mods_to_add: i32,
    pub mods_to_remove: i32,
    pub mods_to_update: i32,
    pub has_version_mismatch: bool,
}

/// Compute the diff between a local manifest and a remote manifest.
///
/// Uses mod name as the primary key for matching. When names match,
/// compares file_hash first (if available), then falls back to version string.
pub fn compute_diff(local: &SyncManifest, remote: &SyncManifest) -> ManifestDiff {
    let version_mismatch = detect_version_mismatch(local, remote);

    let local_by_name: HashMap<&str, &SyncModEntry> = local
        .mods
        .iter()
        .map(|m| (m.mod_name.as_str(), m))
        .collect();

    let remote_by_name: HashMap<&str, &SyncModEntry> = remote
        .mods
        .iter()
        .map(|m| (m.mod_name.as_str(), m))
        .collect();

    let to_add = find_additions(&local_by_name, &remote_by_name);
    let to_remove = find_removals(&local_by_name, &remote_by_name);
    let to_update = find_updates(&local_by_name, &remote_by_name);

    ManifestDiff {
        to_add,
        to_remove,
        to_update,
        version_mismatch,
    }
}

fn detect_version_mismatch(local: &SyncManifest, remote: &SyncManifest) -> Option<VersionMismatch> {
    let mc_differs = local.minecraft_version != remote.minecraft_version;
    let loader_differs = local.loader_type != remote.loader_type;

    if mc_differs || loader_differs {
        return Some(VersionMismatch {
            local_mc_version: local.minecraft_version.clone(),
            remote_mc_version: remote.minecraft_version.clone(),
            local_loader: local.loader_type.clone(),
            remote_loader: remote.loader_type.clone(),
        });
    }

    None
}

/// Mods in remote but not in local -> need to add.
fn find_additions(
    local: &HashMap<&str, &SyncModEntry>,
    remote: &HashMap<&str, &SyncModEntry>,
) -> Vec<SyncModEntry> {
    remote
        .iter()
        .filter(|(name, _)| !local.contains_key(*name))
        .map(|(_, entry)| (*entry).clone())
        .collect()
}

/// Mods in local but not in remote -> need to remove.
fn find_removals(
    local: &HashMap<&str, &SyncModEntry>,
    remote: &HashMap<&str, &SyncModEntry>,
) -> Vec<SyncModEntry> {
    local
        .iter()
        .filter(|(name, _)| !remote.contains_key(*name))
        .map(|(_, entry)| (*entry).clone())
        .collect()
}

/// Mods in both but with different version or hash -> need to update.
fn find_updates(
    local: &HashMap<&str, &SyncModEntry>,
    remote: &HashMap<&str, &SyncModEntry>,
) -> Vec<ModUpdate> {
    local
        .iter()
        .filter_map(|(name, local_entry)| {
            let remote_entry = remote.get(name)?;
            if mod_needs_update(local_entry, remote_entry) {
                Some(ModUpdate {
                    mod_name: name.to_string(),
                    local_version: local_entry.mod_version.clone(),
                    remote_version: remote_entry.mod_version.clone(),
                    source: remote_entry.source.clone(),
                    source_project_id: remote_entry.source_project_id.clone(),
                    source_version_id: remote_entry.source_version_id.clone(),
                    remote_file_name: remote_entry.file_name.clone(),
                    remote_hash: remote_entry.file_hash.clone(),
                })
            } else {
                None
            }
        })
        .collect()
}

/// Determine if a mod needs updating by comparing hash (preferred) or version.
fn mod_needs_update(local: &SyncModEntry, remote: &SyncModEntry) -> bool {
    // If both have hashes, compare hashes (most reliable)
    if let (Some(local_hash), Some(remote_hash)) = (&local.file_hash, &remote.file_hash) {
        return local_hash != remote_hash;
    }

    // Fall back to version string comparison
    local.mod_version != remote.mod_version
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn make_manifest(mods: Vec<SyncModEntry>) -> SyncManifest {
        SyncManifest {
            id: "test-manifest-id".to_string(),
            name: "Test Modpack".to_string(),
            instance_id: "test-instance".to_string(),
            minecraft_version: "1.21.1".to_string(),
            loader_type: Some("fabric".to_string()),
            loader_version: Some("0.16.0".to_string()),
            mods,
            manifest_version: 1,
            created_at: Utc::now(),
        }
    }

    fn make_mod(name: &str, version: &str, hash: Option<&str>) -> SyncModEntry {
        SyncModEntry {
            mod_name: name.to_string(),
            mod_version: version.to_string(),
            file_name: format!("{name}-{version}.jar"),
            file_hash: hash.map(String::from),
            source: "modrinth".to_string(),
            source_project_id: Some(format!("{name}-id")),
            source_version_id: Some(format!("{name}-ver-{version}")),
        }
    }

    #[test]
    fn empty_manifests_produce_empty_diff() {
        let local = make_manifest(vec![]);
        let remote = make_manifest(vec![]);
        let diff = compute_diff(&local, &remote);

        assert!(diff.is_empty());
    }

    #[test]
    fn detects_new_mods_to_add() {
        let local = make_manifest(vec![make_mod("sodium", "0.5.8", None)]);
        let remote = make_manifest(vec![
            make_mod("sodium", "0.5.8", None),
            make_mod("lithium", "0.12.0", None),
        ]);

        let diff = compute_diff(&local, &remote);

        assert_eq!(diff.to_add.len(), 1);
        assert_eq!(diff.to_add[0].mod_name, "lithium");
        assert!(diff.to_remove.is_empty());
        assert!(diff.to_update.is_empty());
    }

    #[test]
    fn detects_mods_to_remove() {
        let local = make_manifest(vec![
            make_mod("sodium", "0.5.8", None),
            make_mod("old-mod", "1.0.0", None),
        ]);
        let remote = make_manifest(vec![make_mod("sodium", "0.5.8", None)]);

        let diff = compute_diff(&local, &remote);

        assert!(diff.to_add.is_empty());
        assert_eq!(diff.to_remove.len(), 1);
        assert_eq!(diff.to_remove[0].mod_name, "old-mod");
    }

    #[test]
    fn detects_mods_to_update_by_version() {
        let local = make_manifest(vec![make_mod("sodium", "0.5.7", None)]);
        let remote = make_manifest(vec![make_mod("sodium", "0.5.8", None)]);

        let diff = compute_diff(&local, &remote);

        assert_eq!(diff.to_update.len(), 1);
        assert_eq!(diff.to_update[0].local_version, "0.5.7");
        assert_eq!(diff.to_update[0].remote_version, "0.5.8");
    }

    #[test]
    fn detects_mods_to_update_by_hash() {
        let local = make_manifest(vec![make_mod("sodium", "0.5.8", Some("aaa"))]);
        let remote = make_manifest(vec![make_mod("sodium", "0.5.8", Some("bbb"))]);

        let diff = compute_diff(&local, &remote);

        assert_eq!(diff.to_update.len(), 1);
    }

    #[test]
    fn same_hash_means_no_update() {
        let local = make_manifest(vec![make_mod("sodium", "0.5.8", Some("aaa"))]);
        let remote = make_manifest(vec![make_mod("sodium", "0.5.8", Some("aaa"))]);

        let diff = compute_diff(&local, &remote);

        assert!(diff.to_update.is_empty());
    }

    #[test]
    fn detects_version_mismatch() {
        let mut local = make_manifest(vec![]);
        local.minecraft_version = "1.20.4".to_string();
        let remote = make_manifest(vec![]);

        let diff = compute_diff(&local, &remote);

        assert!(diff.version_mismatch.is_some());
        let mismatch = diff
            .version_mismatch
            .as_ref()
            .expect("should have mismatch");
        assert_eq!(mismatch.local_mc_version, "1.20.4");
        assert_eq!(mismatch.remote_mc_version, "1.21.1");
    }

    #[test]
    fn complex_diff_scenario() {
        let local = make_manifest(vec![
            make_mod("sodium", "0.5.7", None),
            make_mod("iris", "1.6.0", None),
            make_mod("old-mod", "1.0.0", None),
        ]);
        let remote = make_manifest(vec![
            make_mod("sodium", "0.5.8", None),
            make_mod("iris", "1.6.0", None),
            make_mod("lithium", "0.12.0", None),
        ]);

        let diff = compute_diff(&local, &remote);
        let summary = diff.summary();

        assert_eq!(summary.mods_to_add, 1);
        assert_eq!(summary.mods_to_remove, 1);
        assert_eq!(summary.mods_to_update, 1);
        assert!(!summary.has_version_mismatch);
    }
}
