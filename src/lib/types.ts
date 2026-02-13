// Shared types mirroring the Rust models

export type ModLoader = "vanilla" | "forge" | "fabric" | "neoforge" | "quilt";

export type ModSource = "curseforge" | "modrinth" | "local";

export type SyncStatus = "inactive" | "active" | "syncing";

export interface MinecraftInstance {
  id: string;
  name: string;
  minecraft_version: string;
  loader: ModLoader;
  loader_version: string | undefined;
  instance_path: string;
  icon_path: string | undefined;
  last_played_at: string | undefined;
  total_play_time: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Minecraft versions — mirrors services/minecraft.rs

export interface VersionEntry {
  id: string;
  version_type: string;
  url: string;
  release_time: string;
}

// Download — mirrors services/download.rs

export type DownloadState =
  | "idle"
  | "downloading"
  | "completed"
  | { failed: { message: string } };

export interface DownloadProgress {
  total_files: number;
  completed_files: number;
  total_bytes: number;
  downloaded_bytes: number;
  failed_files: string[];
  state: DownloadState;
}

export interface ModInfo {
  id: string;
  instance_id: string;
  name: string;
  version: string;
  source: ModSource;
  source_id: string | undefined;
  file_name: string;
  file_hash: string | undefined;
  enabled: boolean;
  installed_at: string;
}

export interface SyncSession {
  id: string;
  instance_id: string;
  share_code: string | undefined;
  peer_id: string | undefined;
  is_host: boolean;
  status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export type SyncAction = "joined" | "synced" | "updated" | "left";

export interface SyncHistory {
  id: string;
  session_id: string;
  action: SyncAction;
  peer_name: string | undefined;
  mods_added: number;
  mods_removed: number;
  mods_updated: number;
  created_at: string;
}

export interface SyncManifest {
  id: string;
  name: string;
  instance_id: string;
  minecraft_version: string;
  loader_type: string | undefined;
  loader_version: string | undefined;
  mods: SyncModEntry[];
  manifest_version: number;
  created_at: string;
}

export interface SyncModEntry {
  mod_name: string;
  mod_version: string;
  file_name: string;
  file_hash: string | undefined;
  source: string;
  source_project_id: string | undefined;
  source_version_id: string | undefined;
}

// Sync protocol — mirrors services/sync_protocol

export interface ManifestDiff {
  to_add: SyncModEntry[];
  to_remove: SyncModEntry[];
  to_update: ModUpdate[];
  version_mismatch: VersionMismatch | undefined;
}

export interface ModUpdate {
  mod_name: string;
  local_version: string;
  remote_version: string;
  source: string;
  source_project_id: string | undefined;
  source_version_id: string | undefined;
  remote_file_name: string;
  remote_hash: string | undefined;
}

export interface VersionMismatch {
  local_mc_version: string;
  remote_mc_version: string;
  local_loader: string | undefined;
  remote_loader: string | undefined;
}

export type PendingSyncStatus =
  | "awaiting_confirmation"
  | "syncing"
  | "completed"
  | "rejected";

export interface PendingSync {
  session_id: string;
  remote_peer_id: string;
  local_manifest: SyncManifest;
  remote_manifest: SyncManifest;
  diff: ManifestDiff;
  status: PendingSyncStatus;
}

export interface PreviewSyncResponse {
  session_id: string;
  diff: ManifestDiff;
}

export interface ApplyResult {
  mods_added: string[];
  mods_removed: string[];
  mods_updated: string[];
  errors: string[];
}

// P2P — mirrors services/p2p

export interface P2pStatus {
  is_running: boolean;
  peer_id: string;
}

// Auth — mirrors Rust models/auth.rs

export interface DeviceCodeInfo {
  user_code: string;
  verification_uri: string;
  expires_in: number;
  message: string;
}

export type AuthPollResult =
  | { status: "pending" }
  | { status: "success"; username: string; uuid: string }
  | { status: "expired" }
  | { status: "error"; message: string };

export interface MinecraftProfile {
  username: string;
  uuid: string;
}

// Mod Platform — mirrors Rust models/mod_platform.rs

export type SearchSort = "relevance" | "downloads" | "updated" | "newest";

export type ContentType = "mod" | "modpack";

export interface SearchFilters {
  query: string;
  game_version: string | undefined;
  loader: string | undefined;
  category: string | undefined;
  sort: SearchSort;
  offset: number;
  limit: number;
  content_type?: ContentType;
}

export interface SearchResponse {
  hits: ModSearchResult[];
  total_hits: number;
  offset: number;
  limit: number;
}

export interface ModSearchResult {
  id: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  downloads: number;
  icon_url: string | undefined;
  source: ModSource;
  game_versions: string[];
  loaders: string[];
  date_updated: string;
  date_created: string;
}
