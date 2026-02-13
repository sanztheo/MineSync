use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use chrono::{DateTime, NaiveDateTime, Utc};
use rusqlite::{params, Connection};

use crate::errors::{AppError, AppResult};
use crate::models::account::Account;
use crate::models::instance::{MinecraftInstance, ModLoader};
use crate::models::mod_info::{ModInfo, ModSource};
use crate::models::sync::{SyncHistory, SyncSession, SyncStatus};

pub struct DatabaseService {
    conn: Mutex<Connection>,
}

// --- Date conversion helpers ---

fn parse_dt(s: &str) -> rusqlite::Result<DateTime<Utc>> {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
        .map(|dt| dt.and_utc())
        .map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(e),
            )
        })
}

fn parse_optional_dt(s: Option<String>) -> rusqlite::Result<Option<DateTime<Utc>>> {
    s.map(|s| parse_dt(&s)).transpose()
}

fn format_dt(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d %H:%M:%S").to_string()
}

fn parse_enum_err(msg: String) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(
        0,
        rusqlite::types::Type::Text,
        Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, msg)),
    )
}

// --- Row mappers ---

fn row_to_instance(row: &rusqlite::Row<'_>) -> rusqlite::Result<MinecraftInstance> {
    let loader_str: Option<String> = row.get("loader_type")?;
    let loader = loader_str
        .and_then(|s| s.parse::<ModLoader>().ok())
        .unwrap_or(ModLoader::Vanilla);

    Ok(MinecraftInstance {
        id: row.get("id")?,
        name: row.get("name")?,
        minecraft_version: row.get("minecraft_version")?,
        loader,
        loader_version: row.get("loader_version")?,
        instance_path: row.get("instance_path")?,
        icon_path: row.get("icon_path")?,
        last_played_at: parse_optional_dt(row.get("last_played_at")?)?,
        total_play_time: row.get("total_play_time")?,
        is_active: row.get::<_, i32>("is_active")? != 0,
        created_at: parse_dt(&row.get::<_, String>("created_at")?)?,
        updated_at: parse_dt(&row.get::<_, String>("updated_at")?)?,
    })
}

fn row_to_mod(row: &rusqlite::Row<'_>) -> rusqlite::Result<ModInfo> {
    let source_str: String = row.get("source")?;
    let source = source_str.parse::<ModSource>().map_err(parse_enum_err)?;

    Ok(ModInfo {
        id: row.get("id")?,
        instance_id: row.get("instance_id")?,
        name: row.get("mod_name")?,
        slug: row.get("mod_slug")?,
        version: row.get("mod_version")?,
        file_name: row.get("file_name")?,
        file_hash: row.get("file_hash")?,
        source,
        source_project_id: row.get("source_project_id")?,
        source_version_id: row.get("source_version_id")?,
        is_active: row.get::<_, i32>("is_active")? != 0,
        installed_at: parse_dt(&row.get::<_, String>("installed_at")?)?,
    })
}

fn row_to_sync_session(row: &rusqlite::Row<'_>) -> rusqlite::Result<SyncSession> {
    let status_str: String = row.get("status")?;
    let status = status_str.parse::<SyncStatus>().map_err(parse_enum_err)?;

    Ok(SyncSession {
        id: row.get("id")?,
        instance_id: row.get("instance_id")?,
        share_code: row.get("share_code")?,
        peer_id: row.get("peer_id")?,
        is_host: row.get::<_, i32>("is_host")? != 0,
        status,
        created_at: parse_dt(&row.get::<_, String>("created_at")?)?,
        updated_at: parse_dt(&row.get::<_, String>("updated_at")?)?,
    })
}

fn row_to_account(row: &rusqlite::Row<'_>) -> rusqlite::Result<Account> {
    Ok(Account {
        id: row.get("id")?,
        username: row.get("username")?,
        uuid: row.get("uuid")?,
        access_token: row.get("access_token")?,
        refresh_token: row.get("refresh_token")?,
        token_expires_at: parse_optional_dt(row.get("token_expires_at")?)?,
        is_active: row.get::<_, i32>("is_active")? != 0,
        created_at: parse_dt(&row.get::<_, String>("created_at")?)?,
        updated_at: parse_dt(&row.get::<_, String>("updated_at")?)?,
    })
}

// --- DatabaseService ---

impl DatabaseService {
    pub fn new(db_path: &Path) -> AppResult<Self> {
        let conn = Connection::open(db_path)?;
        // WAL mode for better concurrent read performance, foreign keys for referential integrity
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let service = Self {
            conn: Mutex::new(conn),
        };
        service.run_migrations()?;
        Ok(service)
    }

    fn conn(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|e| AppError::Custom(format!("Database lock poisoned: {e}")))
    }

    fn run_migrations(&self) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                uuid TEXT NOT NULL UNIQUE,
                access_token TEXT,
                refresh_token TEXT,
                token_expires_at TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS instances (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                minecraft_version TEXT NOT NULL,
                loader_type TEXT,
                loader_version TEXT,
                instance_path TEXT NOT NULL,
                icon_path TEXT,
                last_played_at TEXT,
                total_play_time INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS instance_mods (
                id TEXT PRIMARY KEY,
                instance_id TEXT NOT NULL REFERENCES instances(id),
                mod_name TEXT NOT NULL,
                mod_slug TEXT,
                mod_version TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_hash TEXT,
                source TEXT NOT NULL,
                source_project_id TEXT,
                source_version_id TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                installed_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sync_sessions (
                id TEXT PRIMARY KEY,
                instance_id TEXT NOT NULL REFERENCES instances(id),
                share_code TEXT UNIQUE,
                peer_id TEXT,
                is_host INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'inactive',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sync_history (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sync_sessions(id),
                action TEXT NOT NULL,
                peer_name TEXT,
                mods_added INTEGER NOT NULL DEFAULT 0,
                mods_removed INTEGER NOT NULL DEFAULT 0,
                mods_updated INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )?;
        Ok(())
    }

    // --- Instance CRUD ---

    pub fn create_instance(&self, instance: &MinecraftInstance) -> AppResult<()> {
        let conn = self.conn()?;
        let loader = match instance.loader {
            ModLoader::Vanilla => None,
            ref l => Some(l.to_string()),
        };
        conn.execute(
            "INSERT INTO instances (id, name, minecraft_version, loader_type, loader_version,
             instance_path, icon_path, last_played_at, total_play_time, is_active,
             created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                instance.id,
                instance.name,
                instance.minecraft_version,
                loader,
                instance.loader_version,
                instance.instance_path,
                instance.icon_path,
                instance.last_played_at.map(|dt| format_dt(&dt)),
                instance.total_play_time,
                instance.is_active as i32,
                format_dt(&instance.created_at),
                format_dt(&instance.updated_at),
            ],
        )?;
        Ok(())
    }

    pub fn get_instance(&self, id: &str) -> AppResult<Option<MinecraftInstance>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT * FROM instances WHERE id = ?1 AND is_active = 1",
        )?;
        let mut rows = stmt.query_map(params![id], row_to_instance)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn list_instances(&self) -> AppResult<Vec<MinecraftInstance>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT * FROM instances WHERE is_active = 1 ORDER BY updated_at DESC",
        )?;
        let instances = stmt
            .query_map([], row_to_instance)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(instances)
    }

    pub fn update_instance(&self, instance: &MinecraftInstance) -> AppResult<()> {
        let conn = self.conn()?;
        let loader = match instance.loader {
            ModLoader::Vanilla => None,
            ref l => Some(l.to_string()),
        };
        conn.execute(
            "UPDATE instances SET name = ?1, minecraft_version = ?2, loader_type = ?3,
             loader_version = ?4, instance_path = ?5, icon_path = ?6,
             last_played_at = ?7, total_play_time = ?8, updated_at = datetime('now')
             WHERE id = ?9",
            params![
                instance.name,
                instance.minecraft_version,
                loader,
                instance.loader_version,
                instance.instance_path,
                instance.icon_path,
                instance.last_played_at.map(|dt| format_dt(&dt)),
                instance.total_play_time,
                instance.id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_instance(&self, id: &str) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE instances SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    // --- Mod CRUD ---

    pub fn add_mod_to_instance(&self, mod_info: &ModInfo) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO instance_mods (id, instance_id, mod_name, mod_slug, mod_version,
             file_name, file_hash, source, source_project_id, source_version_id,
             is_active, installed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                mod_info.id,
                mod_info.instance_id,
                mod_info.name,
                mod_info.slug,
                mod_info.version,
                mod_info.file_name,
                mod_info.file_hash,
                mod_info.source.to_string(),
                mod_info.source_project_id,
                mod_info.source_version_id,
                mod_info.is_active as i32,
                format_dt(&mod_info.installed_at),
            ],
        )?;
        Ok(())
    }

    pub fn list_instance_mods(&self, instance_id: &str) -> AppResult<Vec<ModInfo>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT * FROM instance_mods WHERE instance_id = ?1 AND is_active = 1
             ORDER BY mod_name ASC",
        )?;
        let mods = stmt
            .query_map(params![instance_id], row_to_mod)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(mods)
    }

    pub fn remove_mod_from_instance(&self, mod_id: &str) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE instance_mods SET is_active = 0 WHERE id = ?1",
            params![mod_id],
        )?;
        Ok(())
    }

    // --- Sync Session CRUD ---

    pub fn create_sync_session(&self, session: &SyncSession) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO sync_sessions (id, instance_id, share_code, peer_id, is_host,
             status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                session.id,
                session.instance_id,
                session.share_code,
                session.peer_id,
                session.is_host as i32,
                session.status.to_string(),
                format_dt(&session.created_at),
                format_dt(&session.updated_at),
            ],
        )?;
        Ok(())
    }

    pub fn get_sync_session(&self, id: &str) -> AppResult<Option<SyncSession>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare("SELECT * FROM sync_sessions WHERE id = ?1")?;
        let mut rows = stmt.query_map(params![id], row_to_sync_session)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn get_sync_session_by_code(&self, share_code: &str) -> AppResult<Option<SyncSession>> {
        let conn = self.conn()?;
        let mut stmt =
            conn.prepare("SELECT * FROM sync_sessions WHERE share_code = ?1")?;
        let mut rows = stmt.query_map(params![share_code], row_to_sync_session)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn update_sync_status(&self, id: &str, status: &SyncStatus) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute(
            "UPDATE sync_sessions SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![status.to_string(), id],
        )?;
        Ok(())
    }

    // --- Sync History ---

    pub fn add_sync_history(&self, entry: &SyncHistory) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO sync_history (id, session_id, action, peer_name,
             mods_added, mods_removed, mods_updated, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                entry.id,
                entry.session_id,
                entry.action.to_string(),
                entry.peer_name,
                entry.mods_added,
                entry.mods_removed,
                entry.mods_updated,
                format_dt(&entry.created_at),
            ],
        )?;
        Ok(())
    }

    // --- Account CRUD ---

    pub fn save_account(&self, account: &Account) -> AppResult<()> {
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO accounts (id, username, uuid, access_token, refresh_token,
             token_expires_at, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(uuid) DO UPDATE SET
                username = excluded.username,
                access_token = excluded.access_token,
                refresh_token = excluded.refresh_token,
                token_expires_at = excluded.token_expires_at,
                is_active = excluded.is_active,
                updated_at = datetime('now')",
            params![
                account.id,
                account.username,
                account.uuid,
                account.access_token,
                account.refresh_token,
                account.token_expires_at.map(|dt| format_dt(&dt)),
                account.is_active as i32,
                format_dt(&account.created_at),
                format_dt(&account.updated_at),
            ],
        )?;
        Ok(())
    }

    pub fn get_active_account(&self) -> AppResult<Option<Account>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT * FROM accounts WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1",
        )?;
        let mut rows = stmt.query_map([], row_to_account)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }
}
