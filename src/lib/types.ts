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
  sync_code: string;
  status: SyncStatus;
  peer_count: number;
  created_at: string;
}

export interface SyncManifest {
  instance_id: string;
  minecraft_version: string;
  loader: string;
  loader_version: string | undefined;
  mods: SyncModEntry[];
  created_at: string;
}

export interface SyncModEntry {
  name: string;
  version: string;
  source: string;
  source_id: string | undefined;
  file_hash: string | undefined;
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

export interface SearchFilters {
  query: string;
  game_version: string | undefined;
  loader: string | undefined;
  category: string | undefined;
  sort: SearchSort;
  offset: number;
  limit: number;
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
