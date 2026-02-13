# Database

## Vue d'ensemble

MineSync utilise **SQLite** via la crate `rusqlite` pour la persistence locale. La base est stockee dans `~/.minesync/database.sqlite` et initialisee au demarrage de l'application.

## Fichier concerne

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/database.rs` | DatabaseService - schema, migrations, CRUD |

## Schema

### Table `accounts`

Stocke les comptes Microsoft/Minecraft authentifies.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | UUID v4 |
| `username` | TEXT | Nom du joueur Minecraft |
| `uuid` | TEXT | UUID Minecraft (format avec tirets) |
| `access_token` | TEXT | Token d'acces Minecraft (pour le jeu) |
| `refresh_token` | TEXT | Token Microsoft (pour renouveler) |
| `expires_at` | TEXT | Date d'expiration du token MC |
| `is_active` | INTEGER | 1 = compte actif, 0 = inactif |
| `created_at` | TEXT | Date de creation |
| `updated_at` | TEXT | Date de derniere modification |

### Table `instances`

Stocke les instances Minecraft (modpacks).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | UUID v4 |
| `name` | TEXT | Nom de l'instance |
| `minecraft_version` | TEXT | Version MC (ex: "1.21.4") |
| `loader_type` | TEXT | "vanilla", "fabric", "forge", "neoforge", "quilt" |
| `loader_version` | TEXT | Version du loader (nullable) |
| `instance_path` | TEXT | Chemin sur le disque |
| `total_play_time` | INTEGER | Temps de jeu en secondes |
| `last_played_at` | TEXT | Derniere session de jeu |
| `is_active` | INTEGER | 1 = active, 0 = supprimee (soft delete) |
| `created_at` | TEXT | Date de creation |
| `updated_at` | TEXT | Date de derniere modification |

### Table `instance_mods`

Stocke les mods installes dans chaque instance.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | UUID v4 |
| `instance_id` | TEXT FK | Reference vers instances.id |
| `name` | TEXT | Nom du mod |
| `slug` | TEXT | Slug du mod (URL-friendly) |
| `version` | TEXT | Version du mod |
| `file_name` | TEXT | Nom du fichier JAR |
| `file_hash` | TEXT | Hash SHA1 du fichier |
| `source` | TEXT | "curseforge" ou "modrinth" |
| `project_id` | TEXT | ID du projet sur la plateforme |
| `is_active` | INTEGER | Soft delete |
| `installed_at` | TEXT | Date d'installation |

### Table `sync_sessions`

Stocke les sessions de synchronisation P2P.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | UUID v4 |
| `instance_id` | TEXT FK | Instance synchronisee |
| `share_code` | TEXT UNIQUE | Code de partage (MINE-XXXXXX) |
| `peer_id` | TEXT | PeerId libp2p du host |
| `is_host` | INTEGER | 1 = host, 0 = receiver |
| `status` | TEXT | "active", "paused", "ended" |
| `created_at` | TEXT | Date de creation |
| `updated_at` | TEXT | Date de derniere modification |

### Table `sync_history`

Journal des operations de synchronisation.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT PK | UUID v4 |
| `session_id` | TEXT FK | Reference vers sync_sessions.id |
| `action` | TEXT | "sync_started", "sync_completed", "sync_rejected" |
| `peer_name` | TEXT | Nom du peer concerne |
| `mods_added` | INTEGER | Nombre de mods ajoutes |
| `mods_removed` | INTEGER | Nombre de mods supprimes |
| `mods_updated` | INTEGER | Nombre de mods mis a jour |
| `created_at` | TEXT | Date de l'operation |

## Configuration SQLite

```rust
// Pragmas appliques a l'initialisation
PRAGMA journal_mode = WAL;      // Write-Ahead Logging pour performances
PRAGMA foreign_keys = ON;       // Contraintes de cles etrangeres actives
```

## Methodes CRUD principales

### Instances

```rust
create_instance(name, mc_version, loader, loader_version, path) -> MinecraftInstance
get_instance(id) -> Option<MinecraftInstance>
list_instances() -> Vec<MinecraftInstance>
update_instance(id, fields...) -> ()
delete_instance(id) -> ()                    // Soft delete (is_active = 0)
update_play_time(id, seconds) -> ()          // Incremente total_play_time
```

### Mods

```rust
add_mod_to_instance(instance_id, mod_info) -> ()
list_instance_mods(instance_id) -> Vec<InstanceMod>
remove_mod_from_instance(instance_id, mod_id) -> ()    // Soft delete
```

### Comptes

```rust
save_account(account) -> ()                    // Upsert sur uuid
get_active_account() -> Option<Account>
update_account_tokens(uuid, tokens...) -> ()
deactivate_all_accounts() -> ()               // Logout : tous a is_active = 0
```

### Sync

```rust
create_sync_session(instance_id, share_code, peer_id, is_host) -> SyncSession
get_sync_session(id) -> Option<SyncSession>
get_sync_session_by_code(code) -> Option<SyncSession>
update_sync_status(id, status) -> ()
```

## Soft Delete

Les suppressions ne sont jamais physiques. Le champ `is_active` passe a `0` et les requetes filtrent sur `is_active = 1`. Cela permet :
- De recuperer des donnees supprimees par erreur
- De garder un historique complet
- D'eviter les problemes de cles etrangeres

## Dates

Les dates sont stockees en format texte ISO-8601 et converties via des helpers :

```rust
fn to_datetime(s: &str) -> Option<DateTime<Utc>>
fn from_datetime(dt: &DateTime<Utc>) -> String
```
