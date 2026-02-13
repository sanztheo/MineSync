# Sync Protocol

This document details the synchronization algorithm used when sharing modpacks between peers.

## Overview

The sync protocol ensures that guests can safely receive modpack updates from hosts while maintaining control over what gets installed.

## Manifest Structure

A modpack manifest contains all information needed to replicate a modpack:

```rust
pub struct ModpackManifest {
    pub version: u32,                    // Protocol version
    pub instance_name: String,           // Human-readable name
    pub minecraft_version: String,       // e.g., "1.20.4"
    pub loader: ModLoader,               // fabric, forge, etc.
    pub loader_version: String,          // Loader version
    pub mods: Vec<ManifestMod>,         // List of mods
    pub checksum: String,                // Manifest integrity hash
    pub updated_at: DateTime<Utc>,       // Last modification
}

pub struct ManifestMod {
    pub name: String,                    // Display name
    pub slug: String,                    // URL-friendly name
    pub source: ModSource,               // curseforge or modrinth
    pub project_id: String,              // Platform project ID
    pub version_id: String,              // Specific version ID
    pub file_name: String,               // JAR filename
    pub file_hash: String,               // SHA1 checksum
    pub file_size: u64,                  // Size in bytes
    pub is_dependency: bool,             // Auto-installed?
}
```

## Sync States

```
┌─────────────────────────────────────────────────────────────────┐
│                      Sync State Machine                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                        ┌──────────┐                            │
│                        │ INACTIVE │                            │
│                        └────┬─────┘                            │
│                             │                                   │
│                   Share / Join                                  │
│                             │                                   │
│                             ▼                                   │
│                        ┌──────────┐                            │
│                        │  ACTIVE  │◄─────────┐                 │
│                        └────┬─────┘          │                 │
│                             │                │                 │
│               Receive manifest diff          │                 │
│                             │                │                 │
│                             ▼                │                 │
│                    ┌────────────────┐        │                 │
│                    │   AWAITING     │        │                 │
│                    │  CONFIRMATION  │        │                 │
│                    └───────┬────────┘        │                 │
│                            │                 │                 │
│              ┌─────────────┴─────────────┐   │                 │
│              │                           │   │                 │
│           Confirm                     Reject │                 │
│              │                           │   │                 │
│              ▼                           │   │                 │
│        ┌──────────┐                      │   │                 │
│        │ SYNCING  │                      │   │                 │
│        └────┬─────┘                      │   │                 │
│             │                            │   │                 │
│         Complete                         │   │                 │
│             │                            │   │                 │
│             ▼                            ▼   │                 │
│        ┌──────────┐              ┌──────────┐│                 │
│        │COMPLETED │              │ REJECTED ││                 │
│        └────┬─────┘              └────┬─────┘│                 │
│             │                         │      │                 │
│             └─────────────────────────┴──────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Diff Algorithm

### Computing Differences

When a new manifest is received, MineSync computes the diff:

```rust
pub fn compute_diff(
    local: &[ManifestMod],
    remote: &[ManifestMod],
) -> ManifestDiff {
    let local_map: HashMap<&str, &ManifestMod> = 
        local.iter().map(|m| (m.project_id.as_str(), m)).collect();
    
    let remote_map: HashMap<&str, &ManifestMod> = 
        remote.iter().map(|m| (m.project_id.as_str(), m)).collect();
    
    let mut additions = Vec::new();
    let mut removals = Vec::new();
    let mut updates = Vec::new();
    
    // Find additions and updates
    for (id, remote_mod) in &remote_map {
        match local_map.get(id) {
            None => additions.push((*remote_mod).clone()),
            Some(local_mod) => {
                if local_mod.version_id != remote_mod.version_id {
                    updates.push(ModUpdate {
                        mod_info: (*remote_mod).clone(),
                        old_version: local_mod.version_id.clone(),
                        new_version: remote_mod.version_id.clone(),
                    });
                }
            }
        }
    }
    
    // Find removals
    for (id, local_mod) in &local_map {
        if !remote_map.contains_key(id) {
            removals.push((*local_mod).clone());
        }
    }
    
    ManifestDiff { additions, removals, updates }
}
```

### Diff Structure

```rust
pub struct ManifestDiff {
    pub additions: Vec<ManifestMod>,  // Mods to add
    pub removals: Vec<ManifestMod>,   // Mods to remove
    pub updates: Vec<ModUpdate>,      // Mods to update
}

pub struct ModUpdate {
    pub mod_info: ManifestMod,        // New mod info
    pub old_version: String,          // Current version
    pub new_version: String,          // Target version
}
```

## Sync Flow

### Host Perspective

```
┌─────────────────────────────────────────────────────────────────┐
│                     Host Sync Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User modifies modpack                                       │
│     ├── Add mod                                                 │
│     ├── Remove mod                                              │
│     └── Update mod version                                      │
│                                                                 │
│  2. Generate new manifest                                       │
│     ├── Collect all mods                                        │
│     ├── Calculate checksum                                      │
│     └── Update timestamp                                        │
│                                                                 │
│  3. Broadcast to connected guests                               │
│     ├── Send manifest via P2P                                   │
│     └── Wait for acknowledgment                                 │
│                                                                 │
│  4. Log sync event                                              │
│     └── Record in sync_history                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Guest Perspective

```
┌─────────────────────────────────────────────────────────────────┐
│                     Guest Sync Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Receive manifest from host                                  │
│     └── Validate structure and checksum                        │
│                                                                 │
│  2. Compute diff with local state                              │
│     ├── Identify additions                                      │
│     ├── Identify removals                                       │
│     └── Identify updates                                        │
│                                                                 │
│  3. Create pending sync request                                 │
│     ├── Store diff in memory                                    │
│     └── Notify user via UI                                      │
│                                                                 │
│  4. Wait for user confirmation                                  │
│     ├── Show diff preview                                       │
│     └── Await confirm/reject                                    │
│                                                                 │
│  5. If confirmed, apply changes                                 │
│     ├── Download new mods                                       │
│     ├── Delete removed mods                                     │
│     ├── Update mod versions                                     │
│     └── Update local database                                   │
│                                                                 │
│  6. Report completion to host                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Applying Changes

### Addition Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Adding a Mod                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For each mod in additions:                                     │
│                                                                 │
│  1. Resolve download URL                                        │
│     ├── CurseForge: GET /v1/mods/{id}/files/{fileId}/          │
│     │              download-url                                 │
│     └── Modrinth: GET /v2/version/{id}                         │
│                                                                 │
│  2. Download file                                               │
│     ├── GET {download_url}                                      │
│     ├── Save to instances/{id}/mods/                           │
│     └── Verify SHA1 hash                                        │
│                                                                 │
│  3. Update database                                             │
│     └── INSERT INTO instance_mods (...)                        │
│                                                                 │
│  4. Resolve dependencies (if needed)                            │
│     ├── Check required dependencies                             │
│     └── Recursively add missing deps                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Removal Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Removing a Mod                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For each mod in removals:                                      │
│                                                                 │
│  1. Delete file from disk                                       │
│     └── rm instances/{id}/mods/{filename}.jar                  │
│                                                                 │
│  2. Update database (soft delete)                               │
│     └── UPDATE instance_mods SET is_active = 0 ...             │
│                                                                 │
│  3. Check orphaned dependencies                                 │
│     ├── Find deps only used by this mod                        │
│     └── Optionally remove orphans                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Updating a Mod                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  For each mod in updates:                                       │
│                                                                 │
│  1. Download new version                                        │
│     └── (Same as addition flow)                                │
│                                                                 │
│  2. Delete old version file                                     │
│     └── rm instances/{id}/mods/{old_filename}.jar              │
│                                                                 │
│  3. Update database record                                      │
│     └── UPDATE instance_mods SET                               │
│         version_id = ?, file_name = ?, file_hash = ?           │
│         WHERE id = ?                                            │
│                                                                 │
│  4. Check dependency changes                                    │
│     ├── New deps? Add them                                      │
│     └── Removed deps? Clean up orphans                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Conflict Resolution

### Version Conflicts

When local modifications conflict with remote changes:

```
Local:  ModA v1.0 (user modified config)
Remote: ModA v1.1 (host updated)

Resolution:
├── Download ModA v1.1
├── Preserve local config files
└── Notify user of version change
```

### Loader Conflicts

If loader versions differ:

```
Local:  Fabric 0.15.0
Remote: Fabric 0.15.7

Resolution:
├── Show warning in diff preview
├── Require explicit confirmation
└── Update loader if confirmed
```

## Integrity Verification

### Manifest Checksum

```rust
fn compute_manifest_checksum(manifest: &ModpackManifest) -> String {
    let mut hasher = Sha256::new();
    
    // Hash deterministically
    hasher.update(manifest.minecraft_version.as_bytes());
    hasher.update(&[manifest.loader as u8]);
    hasher.update(manifest.loader_version.as_bytes());
    
    // Sort mods for deterministic order
    let mut sorted_mods = manifest.mods.clone();
    sorted_mods.sort_by(|a, b| a.project_id.cmp(&b.project_id));
    
    for mod_info in &sorted_mods {
        hasher.update(mod_info.project_id.as_bytes());
        hasher.update(mod_info.version_id.as_bytes());
        hasher.update(mod_info.file_hash.as_bytes());
    }
    
    hex::encode(hasher.finalize())
}
```

### File Verification

Each downloaded mod is verified:

```rust
fn verify_file(path: &Path, expected_hash: &str) -> Result<bool> {
    let mut file = File::open(path)?;
    let mut hasher = Sha1::new();
    
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 { break; }
        hasher.update(&buffer[..bytes_read]);
    }
    
    let hash = hex::encode(hasher.finalize());
    Ok(hash == expected_hash)
}
```

## Error Handling

### Sync Failures

| Error | Handling |
|-------|----------|
| Download failed | Retry 3 times, then skip mod |
| Hash mismatch | Re-download from source |
| Connection lost | Save state, resume on reconnect |
| Disk full | Abort sync, notify user |

### Recovery

Partial syncs are tracked and can be resumed:

```rust
pub struct PartialSync {
    pub sync_id: String,
    pub completed: Vec<String>,     // Successfully applied mods
    pub pending: Vec<String>,       // Not yet applied
    pub failed: Vec<(String, String)>, // (mod_id, error)
}
```

## Bandwidth Considerations

### What Transfers via P2P

| Data | Size | Via P2P |
|------|------|---------|
| Manifest | ~10-50 KB | Yes |
| Mod files | 100KB - 50MB each | No |

### Optimization

- Only manifest diffs are sent (not full manifest each time)
- Mods are downloaded from CDN (CurseForge/Modrinth)
- Delta compression for large manifests

## Next Steps

- [P2P Protocol](P2P-Protocol.md) - Network layer details
- [API Reference](API-Reference.md) - Sync commands
- [Database Schema](Database-Schema.md) - Sync tables
