# Sync Protocol - Index

## Ce module

- [DOC.md](./DOC.md) - Diff de manifeste, confirmation, application des syncs

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [P2P Network](../p2p-network/DOC.md) | Transport des manifestes entre peers |
| [Download Manager](../download-manager/DOC.md) | Telecharge les mods lors de l'application du diff |
| [Mod Platforms](../mod-platforms/DOC.md) | Les mods references dans le manifeste viennent de CF/Modrinth |
| [Database](../database/DOC.md) | Stocke les sessions sync (sync_sessions, sync_history) |
| [Frontend](../frontend/DOC.md) | SyncHub.tsx pour la preview et confirmation du diff |

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/sync_protocol/mod.rs` | SyncProtocolService, PendingSync, PendingSyncStatus |
| `src-tauri/src/services/sync_protocol/manifest_diff.rs` | compute_diff(), ManifestDiff |
| `src-tauri/src/services/sync_protocol/apply_diff.rs` | apply_diff(), ApplyResult |
| `src-tauri/src/commands/sync_protocol.rs` | preview_sync, confirm_sync, reject_sync, apply_sync |
| `src-tauri/src/commands/sync.rs` | create_sync_session, join_sync_session |
| `src/lib/types.ts` | ManifestDiff, ModUpdate, PendingSync, etc. |
