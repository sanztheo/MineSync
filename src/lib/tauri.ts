import { invoke } from "@tauri-apps/api/core";
import type { MinecraftInstance, SyncSession } from "./types";

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
