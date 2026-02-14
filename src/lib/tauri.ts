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
  P2pStatus,
  ManifestDiff,
  PendingSync,
  PreviewSyncResponse,
  SyncManifest,
  ApplyResult,
  ModInfo,
  ModSource,
  ModVersionInfo,
  InstallProgress,
  GameStatus,
  LaunchInfo,
  CrashLog,
  JavaRuntimeStatus,
  JavaInstallResult,
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

export async function searchModpacks(
  filters: SearchFilters,
): Promise<SearchResponse> {
  return invoke<SearchResponse>("search_modpacks", { filters });
}

// Instance commands — mirrors src-tauri/src/commands/instance.rs

export async function createInstance(params: {
  name: string;
  minecraftVersion: string;
  loader: string | undefined;
  loaderVersion: string | undefined;
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

// Launch commands — mirrors src-tauri/src/commands/launch.rs

export async function launchInstance(
  instanceId: string,
  javaPath?: string,
): Promise<LaunchInfo> {
  return invoke<LaunchInfo>("launch_instance", {
    instanceId,
    javaPath: javaPath ?? null,
  });
}

export async function getGameStatus(): Promise<GameStatus> {
  return invoke<GameStatus>("get_game_status");
}

export async function killGame(): Promise<void> {
  return invoke<void>("kill_game");
}

export async function getCrashLog(): Promise<CrashLog | undefined> {
  const result = await invoke<CrashLog | null>("get_crash_log");
  return result ?? undefined;
}

export async function clearCrashLog(): Promise<void> {
  return invoke<void>("clear_crash_log");
}

// Java commands — mirrors src-tauri/src/commands/java.rs

export async function getJavaStatus(): Promise<JavaRuntimeStatus> {
  return invoke<JavaRuntimeStatus>("get_java_status");
}

export async function getJavaInstallProgress(): Promise<JavaRuntimeStatus> {
  return invoke<JavaRuntimeStatus>("get_java_install_progress");
}

export async function installJavaRuntime(): Promise<JavaInstallResult> {
  return invoke<JavaInstallResult>("install_java_runtime");
}

export async function getJavaPath(): Promise<string> {
  return invoke<string>("get_java_path");
}

// P2P commands — mirrors src-tauri/src/commands/p2p.rs

export async function startP2p(): Promise<P2pStatus> {
  return invoke<P2pStatus>("start_p2p");
}

export async function stopP2p(): Promise<void> {
  return invoke<void>("stop_p2p");
}

export async function getP2pStatus(): Promise<P2pStatus> {
  return invoke<P2pStatus>("get_p2p_status");
}

export async function shareModpack(instanceId: string): Promise<string> {
  return invoke<string>("share_modpack", { instanceId });
}

export async function joinViaCode(code: string): Promise<void> {
  return invoke<void>("join_via_code", { code });
}

// Sync protocol commands — mirrors src-tauri/src/commands/sync_protocol.rs

export async function previewSync(
  remotePeerId: string,
  instanceId: string,
  remoteManifest: SyncManifest,
): Promise<PreviewSyncResponse> {
  return invoke<PreviewSyncResponse>("preview_sync", {
    remotePeerId,
    instanceId,
    remoteManifest,
  });
}

export async function getPendingSync(
  sessionId: string,
): Promise<PendingSync | undefined> {
  const result = await invoke<PendingSync | null>("get_pending_sync", {
    sessionId,
  });
  return result ?? undefined;
}

export async function confirmSync(sessionId: string): Promise<ManifestDiff> {
  return invoke<ManifestDiff>("confirm_sync", { sessionId });
}

export async function rejectSync(sessionId: string): Promise<void> {
  return invoke<void>("reject_sync", { sessionId });
}

export async function applySyncSession(
  sessionId: string,
): Promise<ApplyResult> {
  return invoke<ApplyResult>("apply_sync", { sessionId });
}

// Install commands — mirrors src-tauri/src/commands/install.rs

export async function installMod(params: {
  instanceId: string;
  source: ModSource;
  projectId: string;
  versionId: string;
}): Promise<ModInfo> {
  return invoke<ModInfo>("install_mod", params);
}

export async function installModpack(params: {
  source: ModSource;
  projectId: string;
  versionId: string;
  modpackName?: string;
  modpackIconUrl?: string;
  modpackDescription?: string;
}): Promise<MinecraftInstance> {
  return invoke<MinecraftInstance>("install_modpack", params);
}

export async function getInstallProgress(): Promise<InstallProgress> {
  return invoke<InstallProgress>("get_install_progress");
}

export async function getModVersions(params: {
  source: ModSource;
  projectId: string;
  gameVersion?: string;
  loader?: string;
}): Promise<ModVersionInfo[]> {
  return invoke<ModVersionInfo[]>("get_mod_versions", params);
}

export async function listInstanceMods(instanceId: string): Promise<ModInfo[]> {
  return invoke<ModInfo[]>("list_instance_mods", { instanceId });
}

export async function removeMod(modId: string): Promise<void> {
  return invoke<void>("remove_mod", { modId });
}
