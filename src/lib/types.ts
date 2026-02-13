// Shared types mirroring the Rust models

export type ModLoader = "vanilla" | "forge" | "fabric" | "neoforge" | "quilt";

export type ModSource = "curseforge" | "modrinth" | "local";

export type SyncStatus = "waiting" | "syncing" | "completed" | "failed";

export interface MinecraftInstance {
  id: string;
  name: string;
  minecraft_version: string;
  loader: ModLoader;
  loader_version: string | undefined;
  path: string;
  created_at: string;
  updated_at: string;
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
