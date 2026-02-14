import { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadVersion,
  getDownloadProgress,
  getGameStatus,
  getInstance,
  killGame,
  launchInstance,
  listMcVersions,
} from "@/lib/tauri";
import type { DownloadProgress, GameStatus } from "@/lib/types";

const STATUS_POLL_INTERVAL_MS = 2000;
const DOWNLOAD_POLL_INTERVAL_MS = 1000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVE_INSTANCE_STORAGE_KEY = "minesync.launch.active_instance_id";
const PENDING_DOWNLOAD_STORAGE_KEY = "minesync.launch.pending_download";

const IDLE_STATUS: GameStatus = "idle";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function mapLaunchError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("failed to spawn java process")) {
    if (
      lower.includes("os error 2") ||
      lower.includes("no such file") ||
      lower.includes("not found")
    ) {
      return "Java introuvable. Installe Java 21 depuis la popup de démarrage.";
    }
    if (lower.includes("permission denied") || lower.includes("os error 13")) {
      return "Java trouvé, mais impossible de l'exécuter (permission refusée). Vérifie ton installation Java.";
    }
    if (
      lower.includes("argument list too long") ||
      lower.includes("os error 7")
    ) {
      return "Le lancement a échoué: commande Java trop longue. Réessaie avec une instance plus légère.";
    }
    return `Échec du démarrage Java: ${message}`;
  }
  if (lower.includes("java 21 runtime is missing")) {
    return "Java 21 n'est pas encore installé. Utilise la popup de démarrage pour l'installer.";
  }
  if (lower.includes("a game instance is already running")) {
    return "Un jeu est déjà en cours d'exécution.";
  }
  if (lower.includes("no active account")) {
    return "Aucun compte actif. Connecte-toi avant de lancer une instance.";
  }

  return message;
}

function readStorage(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

function isDownloadFailed(
  progress: DownloadProgress,
): progress is DownloadProgress & { state: { failed: { message: string } } } {
  return typeof progress.state === "object" && "failed" in progress.state;
}

export function isGameIdleStatus(status: GameStatus): status is "idle" {
  return status === "idle";
}

export function isGamePreparingStatus(
  status: GameStatus,
): status is "preparing" {
  return status === "preparing";
}

export function isGameRunningStatus(
  status: GameStatus,
): status is { running: { pid: number } } {
  return typeof status === "object" && "running" in status;
}

export function isGameCrashedStatus(
  status: GameStatus,
): status is { crashed: { exit_code: number | null; message: string } } {
  return typeof status === "object" && "crashed" in status;
}

export function getRunningPid(status: GameStatus): number | undefined {
  if (!isGameRunningStatus(status)) return undefined;
  return status.running.pid;
}

export function getCrashInfo(
  status: GameStatus,
): { exitCode: number | null; message: string } | undefined {
  if (!isGameCrashedStatus(status)) return undefined;
  return {
    exitCode: status.crashed.exit_code,
    message: status.crashed.message,
  };
}

interface UseGameStatusResult {
  status: GameStatus;
  launch: (instanceId: string) => Promise<void>;
  kill: () => Promise<void>;
  isRunning: boolean;
  isPreparing: boolean;
  launchError: string | undefined;
  downloadProgress: DownloadProgress | undefined;
  isDownloadingBeforeLaunch: boolean;
  activeInstanceId: string | undefined;
}

export function useGameStatus(): UseGameStatusResult {
  const [status, setStatus] = useState<GameStatus>(IDLE_STATUS);
  const [launchError, setLaunchError] = useState<string | undefined>(undefined);
  const [downloadProgress, setDownloadProgress] = useState<
    DownloadProgress | undefined
  >(undefined);
  const [isDownloadingBeforeLaunch, setIsDownloadingBeforeLaunch] = useState(
    () => readStorage(PENDING_DOWNLOAD_STORAGE_KEY) === "1",
  );
  const [activeInstanceId, setActiveInstanceId] = useState<string | undefined>(
    () => readStorage(ACTIVE_INSTANCE_STORAGE_KEY),
  );

  const setTrackedActiveInstanceId = useCallback(
    (instanceId: string | undefined): void => {
      setActiveInstanceId(instanceId);
      if (instanceId === undefined) {
        removeStorage(ACTIVE_INSTANCE_STORAGE_KEY);
      } else {
        writeStorage(ACTIVE_INSTANCE_STORAGE_KEY, instanceId);
      }
    },
    [],
  );

  const setPendingDownload = useCallback((isPending: boolean): void => {
    setIsDownloadingBeforeLaunch(isPending);
    if (isPending) {
      writeStorage(PENDING_DOWNLOAD_STORAGE_KEY, "1");
    } else {
      removeStorage(PENDING_DOWNLOAD_STORAGE_KEY);
    }
  }, []);

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const nextStatus = await getGameStatus();
      setStatus(nextStatus);
    } catch {
      // Ignore polling errors
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (isGameIdleStatus(status)) return;

    const interval = setInterval(() => {
      refreshStatus();
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [status, refreshStatus]);

  const refreshDownloadState = useCallback(async (): Promise<void> => {
    try {
      const progress = await getDownloadProgress();

      if (progress.state === "downloading") {
        setPendingDownload(true);
        setDownloadProgress(progress);
        return;
      }

      if (isDownloadFailed(progress)) {
        setLaunchError(
          `Échec du téléchargement Minecraft: ${progress.state.failed.message}`,
        );
      }

      setPendingDownload(false);
      setDownloadProgress(undefined);
    } catch {
      // Ignore polling errors
    }
  }, [setPendingDownload]);

  useEffect(() => {
    void refreshDownloadState();
    const interval = setInterval(() => {
      void refreshDownloadState();
    }, DOWNLOAD_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [refreshDownloadState]);

  const launch = useCallback(
    async (instanceId: string): Promise<void> => {
      setLaunchError(undefined);
      setTrackedActiveInstanceId(instanceId);
      setStatus("preparing");
      setPendingDownload(true);

      try {
        const instance = await getInstance(instanceId);
        if (instance === undefined) {
          throw new Error(`Instance introuvable: ${instanceId}`);
        }

        // Required by backend before fetching version detail for download.
        await listMcVersions();

        await downloadVersion(instance.minecraft_version);

        const startedAt = Date.now();

        while (true) {
          const progress = await getDownloadProgress();
          setDownloadProgress(progress);

          if (isDownloadFailed(progress)) {
            throw new Error(
              `Échec du téléchargement Minecraft: ${progress.state.failed.message}`,
            );
          }
          if (progress.state === "completed") {
            break;
          }
          if (Date.now() - startedAt > DOWNLOAD_TIMEOUT_MS) {
            throw new Error("Le téléchargement Minecraft a dépassé le délai.");
          }

          await sleep(DOWNLOAD_POLL_INTERVAL_MS);
        }

        setPendingDownload(false);
        setDownloadProgress(undefined);

        await launchInstance(instanceId);
        await refreshStatus();
      } catch (err: unknown) {
        setPendingDownload(false);
        setDownloadProgress(undefined);

        const message = mapLaunchError(toErrorMessage(err));
        setLaunchError(message);
        await refreshStatus();
      }
    },
    [refreshStatus, setPendingDownload, setTrackedActiveInstanceId],
  );

  const kill = useCallback(async (): Promise<void> => {
    setLaunchError(undefined);
    try {
      await killGame();
      await refreshStatus();
    } catch (err: unknown) {
      setLaunchError(mapLaunchError(toErrorMessage(err)));
    }
  }, [refreshStatus]);

  const { isRunning, isPreparing } = useMemo(
    () => ({
      isRunning: isGameRunningStatus(status),
      isPreparing: isGamePreparingStatus(status),
    }),
    [status],
  );

  return {
    status,
    launch,
    kill,
    isRunning,
    isPreparing,
    launchError,
    downloadProgress,
    isDownloadingBeforeLaunch,
    activeInstanceId,
  };
}
