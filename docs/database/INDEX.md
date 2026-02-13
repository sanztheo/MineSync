# Database - Index

## Ce module

- [DOC.md](./DOC.md) - Schema SQLite, tables, methodes CRUD

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Authentication](../authentication/DOC.md) | Stocke les comptes (tokens, UUID) |
| [Minecraft Engine](../minecraft-engine/DOC.md) | Stocke les instances avec version MC |
| [Mod Platforms](../mod-platforms/DOC.md) | Stocke les mods installes (source, hash) |
| [P2P Network](../p2p-network/DOC.md) | Stocke les sessions sync (share_code, peer_id) |
| [Game Launch](../game-launch/DOC.md) | Lit/ecrit le temps de jeu et les tokens |
| [Sync Protocol](../sync-protocol/DOC.md) | Stocke l'historique des syncs |

## Fichier cle

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/database.rs` | DatabaseService complet (schema + CRUD) |

## Tables

| Table | Contenu | Nombre de colonnes |
|-------|---------|--------------------|
| `accounts` | Comptes Microsoft/Minecraft | 9 |
| `instances` | Instances (modpacks) | 11 |
| `instance_mods` | Mods installes | 11 |
| `sync_sessions` | Sessions P2P | 8 |
| `sync_history` | Journal des syncs | 8 |
