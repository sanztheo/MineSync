# Database Schema

MineSync uses SQLite for local data persistence. The database is stored at `~/.local/share/minesync/minesync.db` (or platform equivalent).

## Configuration

```sql
PRAGMA journal_mode = WAL;      -- Write-Ahead Logging for concurrency
PRAGMA foreign_keys = ON;       -- Enforce referential integrity
```

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Database Schema                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐         ┌──────────────────┐                     │
│  │   accounts   │         │    instances     │                     │
│  ├──────────────┤         ├──────────────────┤                     │
│  │ id (PK)      │         │ id (PK)          │                     │
│  │ uuid         │    ┌───►│ account_id (FK)  │                     │
│  │ username     │    │    │ name             │                     │
│  │ access_token │────┘    │ mc_version       │                     │
│  │ refresh_token│         │ loader_type      │                     │
│  │ ...          │         │ loader_version   │                     │
│  └──────────────┘         │ ...              │                     │
│                           └────────┬─────────┘                     │
│                                    │                               │
│                                    │ 1:N                           │
│                                    ▼                               │
│                           ┌──────────────────┐                     │
│                           │  instance_mods   │                     │
│                           ├──────────────────┤                     │
│                           │ id (PK)          │                     │
│                           │ instance_id (FK) │                     │
│                           │ mod_name         │                     │
│                           │ source           │                     │
│                           │ project_id       │                     │
│                           │ ...              │                     │
│                           └──────────────────┘                     │
│                                                                     │
│  ┌──────────────┐         ┌──────────────────┐                     │
│  │sync_sessions │         │  sync_history    │                     │
│  ├──────────────┤         ├──────────────────┤                     │
│  │ id (PK)      │    1:N  │ id (PK)          │                     │
│  │ instance_id  │────────►│ session_id (FK)  │                     │
│  │ peer_id      │         │ action           │                     │
│  │ share_code   │         │ mod_name         │                     │
│  │ role         │         │ ...              │                     │
│  │ ...          │         └──────────────────┘                     │
│  └──────────────┘                                                  │
│                                                                     │
│  ┌────────────────────┐                                            │
│  │loader_installations│                                            │
│  ├────────────────────┤                                            │
│  │ id (PK)            │                                            │
│  │ loader_type        │                                            │
│  │ loader_version     │                                            │
│  │ mc_version         │                                            │
│  │ installed_at       │                                            │
│  └────────────────────┘                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Tables

### accounts

Stores Microsoft account information and authentication tokens.

```sql
CREATE TABLE accounts (
    id              TEXT PRIMARY KEY,           -- UUID v4
    uuid            TEXT NOT NULL UNIQUE,       -- Microsoft account UUID
    username        TEXT NOT NULL,              -- Minecraft username
    access_token    TEXT NOT NULL,              -- Microsoft access token
    refresh_token   TEXT NOT NULL,              -- Microsoft refresh token
    mc_access_token TEXT,                       -- Minecraft access token
    expires_at      TEXT NOT NULL,              -- Token expiration (ISO-8601)
    is_active       INTEGER NOT NULL DEFAULT 1, -- Soft delete flag
    created_at      TEXT NOT NULL,              -- Creation timestamp
    updated_at      TEXT NOT NULL               -- Last update timestamp
);

CREATE INDEX idx_accounts_uuid ON accounts(uuid);
CREATE INDEX idx_accounts_active ON accounts(is_active);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID v4) |
| uuid | TEXT | Microsoft account UUID |
| username | TEXT | Minecraft display name |
| access_token | TEXT | Microsoft OAuth access token |
| refresh_token | TEXT | Microsoft OAuth refresh token |
| mc_access_token | TEXT | Minecraft authentication token |
| expires_at | TEXT | Token expiration (ISO-8601) |
| is_active | INTEGER | 1 = active, 0 = deleted |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last modification timestamp |

### instances

Stores Minecraft instance (modpack) configurations.

```sql
CREATE TABLE instances (
    id              TEXT PRIMARY KEY,           -- UUID v4
    account_id      TEXT,                       -- Owner account (nullable)
    name            TEXT NOT NULL,              -- Instance display name
    mc_version      TEXT NOT NULL,              -- Minecraft version
    loader_type     TEXT NOT NULL DEFAULT 'vanilla', -- Mod loader type
    loader_version  TEXT,                       -- Mod loader version
    java_path       TEXT,                       -- Custom Java path
    ram_min         INTEGER DEFAULT 1024,       -- Min RAM (MB)
    ram_max         INTEGER DEFAULT 4096,       -- Max RAM (MB)
    sync_status     TEXT DEFAULT 'inactive',    -- P2P sync status
    last_played     TEXT,                       -- Last launch timestamp
    is_active       INTEGER NOT NULL DEFAULT 1, -- Soft delete flag
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE INDEX idx_instances_account ON instances(account_id);
CREATE INDEX idx_instances_active ON instances(is_active);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID v4) |
| account_id | TEXT | FK to accounts (nullable) |
| name | TEXT | Instance display name |
| mc_version | TEXT | Minecraft version (e.g., "1.20.4") |
| loader_type | TEXT | `vanilla`, `fabric`, `forge`, `neoforge`, `quilt` |
| loader_version | TEXT | Mod loader version |
| java_path | TEXT | Custom Java executable path |
| ram_min | INTEGER | Minimum RAM allocation (MB) |
| ram_max | INTEGER | Maximum RAM allocation (MB) |
| sync_status | TEXT | `inactive`, `active`, `syncing` |
| last_played | TEXT | Last game launch timestamp |
| is_active | INTEGER | Soft delete flag |

### instance_mods

Stores mods installed in each instance.

```sql
CREATE TABLE instance_mods (
    id              TEXT PRIMARY KEY,           -- UUID v4
    instance_id     TEXT NOT NULL,              -- Parent instance
    mod_name        TEXT NOT NULL,              -- Mod display name
    mod_slug        TEXT,                       -- URL-friendly name
    source          TEXT NOT NULL,              -- 'curseforge' or 'modrinth'
    project_id      TEXT NOT NULL,              -- Platform project ID
    version_id      TEXT NOT NULL,              -- Installed version ID
    file_name       TEXT NOT NULL,              -- JAR file name
    file_hash       TEXT,                       -- SHA1 hash
    file_size       INTEGER,                    -- File size in bytes
    is_dependency   INTEGER DEFAULT 0,          -- Is auto-installed dependency
    is_active       INTEGER NOT NULL DEFAULT 1, -- Soft delete flag
    installed_at    TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_mods_instance ON instance_mods(instance_id);
CREATE INDEX idx_mods_source ON instance_mods(source, project_id);
CREATE INDEX idx_mods_active ON instance_mods(is_active);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID v4) |
| instance_id | TEXT | FK to instances |
| mod_name | TEXT | Display name |
| mod_slug | TEXT | URL slug |
| source | TEXT | `curseforge` or `modrinth` |
| project_id | TEXT | Platform-specific project ID |
| version_id | TEXT | Installed version ID |
| file_name | TEXT | Downloaded JAR filename |
| file_hash | TEXT | SHA1 checksum |
| file_size | INTEGER | File size (bytes) |
| is_dependency | INTEGER | 1 if auto-installed |
| is_active | INTEGER | Soft delete flag |

### sync_sessions

Tracks active P2P synchronization sessions.

```sql
CREATE TABLE sync_sessions (
    id              TEXT PRIMARY KEY,           -- UUID v4
    instance_id     TEXT NOT NULL,              -- Synced instance
    peer_id         TEXT NOT NULL,              -- libp2p peer ID
    share_code      TEXT NOT NULL UNIQUE,       -- MINE-XXXXXX code
    role            TEXT NOT NULL,              -- 'host' or 'guest'
    status          TEXT DEFAULT 'active',      -- Session status
    connected_peers INTEGER DEFAULT 0,          -- Number of connected peers
    last_sync       TEXT,                       -- Last sync timestamp
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_instance ON sync_sessions(instance_id);
CREATE INDEX idx_sessions_code ON sync_sessions(share_code);
CREATE INDEX idx_sessions_active ON sync_sessions(is_active);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID v4) |
| instance_id | TEXT | FK to instances |
| peer_id | TEXT | libp2p PeerId string |
| share_code | TEXT | Share code (MINE-XXXXXX) |
| role | TEXT | `host` or `guest` |
| status | TEXT | `active`, `paused`, `ended` |
| connected_peers | INTEGER | Currently connected peers |
| last_sync | TEXT | Last successful sync |

### sync_history

Records synchronization events for audit trail.

```sql
CREATE TABLE sync_history (
    id              TEXT PRIMARY KEY,           -- UUID v4
    session_id      TEXT NOT NULL,              -- Parent session
    action          TEXT NOT NULL,              -- 'add', 'remove', 'update'
    mod_name        TEXT NOT NULL,              -- Affected mod name
    mod_source      TEXT,                       -- Mod source platform
    mod_version     TEXT,                       -- Mod version
    peer_id         TEXT,                       -- Initiating peer
    status          TEXT DEFAULT 'completed',   -- Action status
    created_at      TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sync_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_history_session ON sync_history(session_id);
CREATE INDEX idx_history_action ON sync_history(action);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID v4) |
| session_id | TEXT | FK to sync_sessions |
| action | TEXT | `add`, `remove`, `update` |
| mod_name | TEXT | Affected mod name |
| mod_source | TEXT | `curseforge` or `modrinth` |
| mod_version | TEXT | New version (for updates) |
| peer_id | TEXT | Peer that initiated action |
| status | TEXT | `completed`, `failed`, `reverted` |

### loader_installations

Tracks installed mod loader versions to avoid re-downloading.

```sql
CREATE TABLE loader_installations (
    id              TEXT PRIMARY KEY,           -- UUID v4
    loader_type     TEXT NOT NULL,              -- 'fabric', 'forge', etc.
    loader_version  TEXT NOT NULL,              -- Loader version
    mc_version      TEXT NOT NULL,              -- Minecraft version
    install_path    TEXT NOT NULL,              -- Installation directory
    installed_at    TEXT NOT NULL,
    UNIQUE(loader_type, loader_version, mc_version)
);

CREATE INDEX idx_loader_type ON loader_installations(loader_type);
CREATE INDEX idx_loader_mc ON loader_installations(mc_version);
```

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID v4) |
| loader_type | TEXT | `fabric`, `forge`, `neoforge`, `quilt` |
| loader_version | TEXT | Loader version string |
| mc_version | TEXT | Compatible Minecraft version |
| install_path | TEXT | Path to installed loader |
| installed_at | TEXT | Installation timestamp |

## Soft Delete Pattern

All main tables use soft delete via `is_active` flag:

```sql
-- "Delete" a record
UPDATE instances SET is_active = 0, updated_at = ? WHERE id = ?;

-- Query active records only
SELECT * FROM instances WHERE is_active = 1;

-- Include deleted in admin queries
SELECT * FROM instances; -- All records
```

Benefits:
- Data recovery possible
- Referential integrity maintained
- Audit trail preserved

## Common Queries

### Get instance with mod count

```sql
SELECT 
    i.*,
    COUNT(m.id) as mod_count
FROM instances i
LEFT JOIN instance_mods m ON m.instance_id = i.id AND m.is_active = 1
WHERE i.is_active = 1
GROUP BY i.id
ORDER BY i.updated_at DESC;
```

### Get mods for an instance

```sql
SELECT * FROM instance_mods
WHERE instance_id = ?
  AND is_active = 1
ORDER BY mod_name ASC;
```

### Get active sync sessions

```sql
SELECT 
    s.*,
    i.name as instance_name
FROM sync_sessions s
JOIN instances i ON i.id = s.instance_id
WHERE s.is_active = 1
  AND s.status = 'active';
```

### Check if loader is installed

```sql
SELECT * FROM loader_installations
WHERE loader_type = ?
  AND loader_version = ?
  AND mc_version = ?;
```

## Migrations

Migrations are applied automatically on startup in `services/database.rs`:

```rust
fn apply_migrations(conn: &Connection) -> Result<()> {
    let version: i32 = conn.query_row(
        "PRAGMA user_version",
        [],
        |row| row.get(0)
    )?;
    
    if version < 1 {
        // Initial schema
        conn.execute_batch(SCHEMA_V1)?;
        conn.execute("PRAGMA user_version = 1", [])?;
    }
    
    if version < 2 {
        // Add loader_installations table
        conn.execute_batch(MIGRATION_V2)?;
        conn.execute("PRAGMA user_version = 2", [])?;
    }
    
    // ... more migrations
    
    Ok(())
}
```

## Backup & Recovery

### Manual Backup

```bash
# Copy database file
cp ~/.local/share/minesync/minesync.db ~/backup/minesync.db

# Or use SQLite backup command
sqlite3 ~/.local/share/minesync/minesync.db ".backup ~/backup/minesync.db"
```

### Recovery

```bash
# Restore from backup
cp ~/backup/minesync.db ~/.local/share/minesync/minesync.db
```

## Performance Tips

1. **WAL Mode**: Already enabled for concurrent reads
2. **Indexes**: Created on frequently queried columns
3. **Batch Operations**: Use transactions for bulk inserts
4. **Connection Reuse**: Single connection wrapped in `Arc<Mutex<>>`

## Next Steps

- [API Reference](API-Reference.md) - Database-related commands
- [Architecture](Architecture.md) - How database fits in
