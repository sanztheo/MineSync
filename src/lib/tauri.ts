import { invoke } from "@tauri-apps/api/core";
import type {
  MinecraftInstance,
  SyncSession,
  DeviceCodeInfo,
  AuthPollResult,
  MinecraftProfile,
  SearchFilters,
  SearchResponse,
  VersionEntry,
  DownloadProgress,
} from "./types";

export async function listInstances(): Promise<MinecraftInstance[]> {
  return invoke<MinecraftInstance[]>("list_instances");
}

export async function getInstance(
  id: string,
): Promise<MinecraftInstance | undefined> {
  const result = await invoke<MinecraftInstance | null>("get_instance", { id });
  return result ?? undefined;
}

export async function createSyncSession(
  instanceId: string,
): Promise<SyncSession> {
  return invoke<SyncSession>("create_sync_session", {
    instanceId,
  });
}

export async function joinSyncSession(syncCode: string): Promise<SyncSession> {
  return invoke<SyncSession>("join_sync_session", { syncCode });
}

// Auth commands — mirrors src-tauri/src/commands/auth.rs

export async function startAuth(): Promise<DeviceCodeInfo> {
  return invoke<DeviceCodeInfo>("start_auth");
}

export async function pollAuth(): Promise<AuthPollResult> {
  return invoke<AuthPollResult>("poll_auth");
}

export async function getProfile(): Promise<MinecraftProfile | undefined> {
  const result = await invoke<MinecraftProfile | null>("get_profile");
  return result ?? undefined;
}

export async function logout(): Promise<void> {
  return invoke<void>("logout");
}

export async function refreshAuth(): Promise<MinecraftProfile> {
  return invoke<MinecraftProfile>("refresh_auth");
}

// Mod platform commands — mirrors src-tauri/src/commands/mods.rs

export async function searchMods(
  filters: SearchFilters,
): Promise<SearchResponse> {
  return invoke<SearchResponse>("search_mods", { filters });
}

// Instance commands — mirrors src-tauri/src/commands/instance.rs

export async function createInstance(params: {
  name: string;
  minecraft_version: string;
  loader: string | undefined;
  loader_version: string | undefined;
  instance_path: string;
}): Promise<MinecraftInstance> {
  return invoke<MinecraftInstance>("create_instance", params);
}

export async function deleteInstance(id: string): Promise<void> {
  return invoke<void>("delete_instance", { id });
}

// Minecraft commands — mirrors src-tauri/src/commands/minecraft.rs

export async function listMcVersions(): Promise<VersionEntry[]> {
  return invoke<VersionEntry[]>("list_mc_versions");
}

export async function downloadVersion(versionId: string): Promise<void> {
  return invoke<void>("download_version", { versionId });
}

export async function getDownloadProgress(): Promise<DownloadProgress> {
  return invoke<DownloadProgress>("get_download_progress");
}
