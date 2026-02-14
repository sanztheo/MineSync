import {
  type ReactNode,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { CrashLogModal } from "@/components/CrashLogModal";
import {
  Plus,
  Play,
  RefreshCw,
  Loader2,
  AlertCircle,
  Gamepad2,
  Trash2,
  MoreVertical,
} from "@/components/ui/PixelIcon";
import { useTauriCommand } from "@/hooks/use-tauri";
import { useInstallProgress } from "@/hooks/use-install-progress";
import {
  useGameStatus,
  isGameCrashedStatus,
  isGamePreparingStatus,
  isGameRunningStatus,
} from "@/hooks/use-game-status";
import { useJavaRuntime } from "@/hooks/use-java-runtime";
import {
  listInstances,
  listMcVersions,
  createInstance,
  deleteInstance,
  getCrashLog,
  clearCrashLog,
} from "@/lib/tauri";
import type {
  MinecraftInstance,
  ModLoader,
  VersionEntry,
  InstallProgress,
  InstallStage,
  DownloadProgress,
  GameStatus,
  CrashLog,
} from "@/lib/types";

// --- Constants ---

const LOADER_BADGE_VARIANT: Record<
  ModLoader,
  "success" | "info" | "warning" | "default" | "danger"
> = {
  fabric: "info",
  forge: "warning",
  neoforge: "danger",
  quilt: "success",
  vanilla: "default",
};

const LOADER_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "vanilla", label: "Vanilla" },
  { value: "fabric", label: "Fabric" },
  { value: "forge", label: "Forge" },
  { value: "neoforge", label: "NeoForge" },
  { value: "quilt", label: "Quilt" },
];

// --- Helpers ---

function formatPlayTime(seconds: number): string {
  if (seconds <= 0) return "Never played";
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${String(hours)}h played`;
  const mins = Math.floor(seconds / 60);
  return `${String(mins)}m played`;
}

function shortStageLabel(stage: InstallStage): string {
  switch (stage.type) {
    case "fetching_info":
      return "Fetching info…";
    case "downloading_pack":
      return "Downloading pack…";
    case "extracting_pack":
      return "Extracting…";
    case "creating_instance":
      return "Creating…";
    case "downloading_minecraft":
      return "Downloading MC…";
    case "installing_loader":
      return "Installing loader…";
    case "resolving_mods":
      return "Resolving mods…";
    case "downloading_mods":
      return `Mods ${String(stage.current)}/${String(stage.total)}`;
    case "copying_overrides":
      return "Copying files…";
    case "registering_mods":
      return "Registering…";
    case "completed":
      return "Done!";
    case "failed":
      return "Failed";
  }
}

function getDownloadPercent(progress: DownloadProgress): number {
  if (progress.total_bytes <= 0) return 0;
  return Math.min(
    100,
    (progress.downloaded_bytes / progress.total_bytes) * 100,
  );
}

function gameStatusBadge(
  status: GameStatus,
): { label: string; variant: "success" | "info" | "danger" } | undefined {
  if (isGameRunningStatus(status)) {
    return { label: "Running", variant: "success" };
  }
  if (isGamePreparingStatus(status)) {
    return { label: "Preparing…", variant: "info" };
  }
  if (isGameCrashedStatus(status)) {
    return { label: "Crashed", variant: "danger" };
  }
  return undefined;
}

// --- Sub-components ---

function InstanceCard({
  instance,
  onPlay,
  onDelete,
  installProgress,
  gameStatus,
  actionsDisabled,
  showLaunchDownload,
  launchDownloadProgress,
}: {
  instance: MinecraftInstance;
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
  installProgress: InstallProgress | undefined;
  gameStatus: GameStatus;
  actionsDisabled: boolean;
  showLaunchDownload: boolean;
  launchDownloadProgress: DownloadProgress | undefined;
}): ReactNode {
  const [menuOpen, setMenuOpen] = useState(false);
  const isInstalling = installProgress?.instance_id === instance.id;
  const status = gameStatusBadge(gameStatus);

  return (
    <div className="group relative">
      <Link to={`/instance/${instance.id}`} className="block">
        <Card hoverable className="flex flex-col gap-3">
          {/* Icon area */}
          <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-notion-bg-tertiary)]">
            {instance.icon_url !== undefined ? (
              <img
                src={instance.icon_url}
                alt={instance.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <Gamepad2
                size={32}
                style={{ color: "var(--color-notion-text-disabled)" }}
              />
            )}

            {/* Installing overlay */}
            {isInstalling && installProgress !== undefined && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg backdrop-blur-sm"
                style={{ background: "var(--color-notion-bg-secondary)" }}
              >
                <Loader2
                  size={20}
                  className="animate-spin"
                  style={{ color: "var(--color-notion-text-tertiary)" }}
                />
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: "var(--color-notion-text-secondary)" }}
                >
                  {shortStageLabel(installProgress.stage)}
                </span>
                <div
                  className="mx-4 h-2 w-3/4 overflow-hidden rounded-full"
                  style={{ background: "var(--color-notion-bg-hover)" }}
                >
                  <div
                    className="h-full rounded-full bg-[var(--color-accent-blue)] transition-all duration-300"
                    style={{
                      width: `${String(Math.min(100, installProgress.overall_percent))}%`,
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "var(--color-notion-text-tertiary)" }}
                >
                  {installProgress.overall_percent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-1.5">
            <h3
              className="truncate text-sm font-bold"
              style={{ color: "var(--color-notion-text)" }}
            >
              {instance.name}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant={LOADER_BADGE_VARIANT[instance.loader]}>
                {instance.loader}
              </Badge>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--color-notion-text-tertiary)" }}
              >
                {instance.minecraft_version}
              </span>
              {status !== undefined && (
                <Badge variant={status.variant}>{status.label}</Badge>
              )}
            </div>
            <span
              className="text-[11px]"
              style={{ color: "var(--color-notion-text-tertiary)" }}
            >
              {isInstalling
                ? "Installing…"
                : formatPlayTime(instance.total_play_time)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            {isInstalling ? (
              <Button
                size="sm"
                disabled
                icon={<Loader2 size={12} className="animate-spin" />}
              >
                Installing
              </Button>
            ) : showLaunchDownload && launchDownloadProgress !== undefined ? (
              <>
                <Button
                  size="sm"
                  disabled
                  icon={<Loader2 size={12} className="animate-spin" />}
                >
                  Preparing launch…
                </Button>
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--color-notion-bg-tertiary)" }}
                >
                  <div
                    className="h-full rounded-full bg-[var(--color-accent-blue)] transition-all duration-300"
                    style={{
                      width: `${String(getDownloadPercent(launchDownloadProgress))}%`,
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "var(--color-notion-text-tertiary)" }}
                >
                  {getDownloadPercent(launchDownloadProgress).toFixed(0)}%
                </span>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={actionsDisabled}
                  icon={<Play size={12} />}
                  onClick={(e) => {
                    e.preventDefault();
                    void onPlay(instance.id);
                  }}
                >
                  Play
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={actionsDisabled}
                  icon={<RefreshCw size={12} />}
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                >
                  Sync
                </Button>
              </div>
            )}
          </div>
        </Card>
      </Link>

      {/* Context menu trigger */}
      {!isInstalling && !actionsDisabled && (
        <div className="absolute right-3 top-3">
          <button
            onClick={() => {
              setMenuOpen((prev) => !prev);
            }}
            aria-label="Instance options"
            className="rounded-md p-1 opacity-0 transition-all hover:bg-[var(--color-notion-bg-hover)] hover:text-[var(--color-notion-text-secondary)] group-hover:opacity-100"
            style={{ color: "var(--color-notion-text-tertiary)" }}
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-9 z-10 w-36 rounded-md py-1"
              style={{
                background: "var(--color-notion-bg-secondary)",
                boxShadow: "var(--shadow-sm-theme)",
              }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(instance.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-[var(--color-accent-red-bg)]"
                style={{ color: "var(--color-accent-red)" }}
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Ghost card shown in the instance grid while a modpack is being installed
 * but the instance hasn't been persisted to the DB yet.
 * Mirrors the Modrinth launcher pattern: install → navigate to Home → see progress.
 */
function InstallingCard({
  progress,
}: {
  progress: InstallProgress;
}): ReactNode {
  return (
    <div className="group relative">
      <Card className="flex flex-col gap-3">
        {/* Icon area with progress overlay */}
        <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-notion-bg-tertiary)]">
          {progress.modpack_icon_url !== undefined ? (
            <img
              src={progress.modpack_icon_url}
              alt={progress.modpack_name ?? "Installing modpack"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Gamepad2
              size={32}
              style={{ color: "var(--color-notion-text-disabled)" }}
            />
          )}

          {/* Progress overlay — always shown on ghost card */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg backdrop-blur-sm"
            style={{ background: "rgba(0, 0, 0, 0.65)" }}
          >
            <Loader2
              size={20}
              className="animate-spin"
              style={{ color: "var(--color-notion-text-tertiary)" }}
            />
            <span
              className="text-[10px] font-semibold"
              style={{ color: "var(--color-notion-text-secondary)" }}
            >
              {shortStageLabel(progress.stage)}
            </span>
            <div
              className="mx-4 h-2 w-3/4 overflow-hidden rounded-full"
              style={{ background: "var(--color-notion-bg-hover)" }}
            >
              <div
                className="h-full rounded-full bg-[var(--color-accent-blue)] transition-all duration-300"
                style={{
                  width: `${String(Math.min(100, progress.overall_percent))}%`,
                }}
              />
            </div>
            <span
              className="text-[10px] font-medium"
              style={{ color: "var(--color-notion-text-tertiary)" }}
            >
              {progress.overall_percent.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1.5">
          <h3
            className="truncate text-sm font-bold"
            style={{ color: "var(--color-notion-text)" }}
          >
            {progress.modpack_name ?? "Installing modpack…"}
          </h3>
          <span
            className="text-[11px]"
            style={{ color: "var(--color-notion-text-tertiary)" }}
          >
            Installing…
          </span>
        </div>

        {/* Disabled action */}
        <div className="flex flex-col gap-2 pt-1">
          <Button
            size="sm"
            disabled
            icon={<Loader2 size={12} className="animate-spin" />}
          >
            Installing
          </Button>
        </div>
      </Card>
    </div>
  );
}

function CreateInstanceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}): ReactNode {
  const [name, setName] = useState("");
  const [mcVersion, setMcVersion] = useState("");
  const [loader, setLoader] = useState("vanilla");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const {
    data: versions,
    loading: versionsLoading,
    error: versionsError,
    refetch: refetchVersions,
  } = useTauriCommand<VersionEntry[]>(listMcVersions);

  const releaseVersions = useMemo(
    () => (versions ?? []).filter((v) => v.version_type === "release"),
    [versions],
  );

  const canCreate = name.trim().length > 0 && mcVersion !== "";

  const handleCreate = useCallback(async (): Promise<void> => {
    if (!canCreate) return;
    setCreating(true);
    setError(undefined);
    try {
      await createInstance({
        name: name.trim(),
        minecraftVersion: mcVersion,
        loader: loader !== "vanilla" ? loader : undefined,
        loaderVersion: undefined,
      });
      setName("");
      setMcVersion("");
      setLoader("vanilla");
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setCreating(false);
    }
  }, [canCreate, name, mcVersion, loader, onCreated, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Instance"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canCreate || creating}
            onClick={handleCreate}
            icon={
              creating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )
            }
          >
            {creating ? "Creating…" : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Instance name"
          placeholder="My Modpack…"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />

        <div className="flex flex-col gap-1.5">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--color-notion-text-secondary)" }}
          >
            Minecraft version
          </span>
          {versionsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: "var(--color-notion-text-tertiary)" }}
              />
              <span
                className="text-xs"
                style={{ color: "var(--color-notion-text-tertiary)" }}
              >
                Loading versions…
              </span>
            </div>
          ) : versionsError !== undefined ? (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: "var(--color-accent-red-bg)" }}
            >
              <AlertCircle
                size={14}
                className="shrink-0"
                style={{ color: "var(--color-accent-red)" }}
              />
              <span
                className="text-xs"
                style={{ color: "var(--color-accent-red)" }}
              >
                {versionsError}
              </span>
              <button
                type="button"
                onClick={refetchVersions}
                className="ml-auto text-xs font-medium text-[var(--color-accent-blue)] hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <select
              value={mcVersion}
              onChange={(e) => {
                setMcVersion(e.target.value);
              }}
              className="rounded-[5px] px-3 py-2 text-sm"
              style={{
                background: "var(--color-notion-bg-secondary)",
                border: "1px solid var(--color-notion-border)",
                color: "var(--color-notion-text)",
              }}
            >
              <option value="">Select version…</option>
              {releaseVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--color-notion-text-secondary)" }}
          >
            Mod loader
          </span>
          <select
            value={loader}
            onChange={(e) => {
              setLoader(e.target.value);
            }}
            className="rounded-[5px] px-3 py-2 text-sm"
            style={{
              background: "var(--color-notion-bg-secondary)",
              border: "1px solid var(--color-notion-border)",
              color: "var(--color-notion-text)",
            }}
          >
            {LOADER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error !== undefined && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--color-accent-red-bg)" }}
          >
            <AlertCircle
              size={14}
              style={{ color: "var(--color-accent-red)" }}
            />
            <span
              className="text-xs"
              style={{ color: "var(--color-accent-red)" }}
            >
              {error}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// --- Main ---

export function Home(): ReactNode {
  const {
    data: instances,
    loading,
    error,
    refetch,
  } = useTauriCommand(listInstances);
  const { progress: installProgress, isInstalling } = useInstallProgress();
  const {
    status: gameStatus,
    launch,
    isRunning,
    isPreparing,
    launchError,
    isDownloadingBeforeLaunch,
    downloadProgress,
    activeInstanceId,
  } = useGameStatus();
  const { isReady: isJavaReady } = useJavaRuntime();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | undefined>(
    undefined,
  );
  const [deleting, setDeleting] = useState(false);
  const actionsLocked =
    isRunning || isPreparing || isDownloadingBeforeLaunch || !isJavaReady;

  // Crash log modal state
  const [crashModalOpen, setCrashModalOpen] = useState(false);
  const [crashLog, setCrashLog] = useState<CrashLog | undefined>(undefined);
  const [crashLogLoading, setCrashLogLoading] = useState(false);
  // Track if we already auto-opened the modal for the current crash
  const crashAutoOpened = useRef(false);

  // Auto-open crash modal when a crash is detected
  useEffect(() => {
    if (isGameCrashedStatus(gameStatus) && !crashAutoOpened.current) {
      crashAutoOpened.current = true;
      setCrashLogLoading(true);
      setCrashModalOpen(true);
      void getCrashLog()
        .then((log) => {
          setCrashLog(log);
        })
        .catch(() => {
          // If we can't get the log, still show the modal with basic info
          setCrashLog(undefined);
        })
        .finally(() => {
          setCrashLogLoading(false);
        });
    } else if (!isGameCrashedStatus(gameStatus)) {
      // Reset when no longer crashed
      crashAutoOpened.current = false;
    }
  }, [gameStatus]);

  const handleCloseCrashModal = useCallback((): void => {
    setCrashModalOpen(false);
    setCrashLog(undefined);
    void clearCrashLog();
  }, []);

  const handleOpenCrashModal = useCallback((): void => {
    setCrashLogLoading(true);
    setCrashModalOpen(true);
    void getCrashLog()
      .then((log) => {
        setCrashLog(log);
      })
      .catch(() => {
        setCrashLog(undefined);
      })
      .finally(() => {
        setCrashLogLoading(false);
      });
  }, []);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (deleteConfirmId === undefined) return;
    setDeleting(true);
    try {
      await deleteInstance(deleteConfirmId);
      setDeleteConfirmId(undefined);
      refetch();
    } catch {
      // Delete failed silently
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmId, refetch]);

  const activeInstances = useMemo(
    () => (instances ?? []).filter((i) => i.is_active),
    [instances],
  );

  // Show ghost card when installing and no matching instance exists in the grid yet
  const showGhostCard =
    isInstalling &&
    installProgress !== undefined &&
    !activeInstances.some((i) => i.id === installProgress.instance_id);

  // Auto-refetch instances when installation finishes so the real card replaces the ghost
  const prevInstallingRef = useRef(false);
  useEffect(() => {
    if (prevInstallingRef.current && !isInstalling) {
      refetch();
    }
    prevInstallingRef.current = isInstalling;
  }, [isInstalling, refetch]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--color-notion-text)" }}
          >
            My Instances
          </h1>
          <p
            className="mt-0.5 text-sm"
            style={{ color: "var(--color-notion-text-tertiary)" }}
          >
            Manage your Minecraft instances
          </p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => {
            setCreateOpen(true);
          }}
        >
          New Instance
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2
            size={24}
            className="animate-spin"
            style={{ color: "var(--color-notion-text-tertiary)" }}
          />
          <span
            className="ml-3 text-sm"
            style={{ color: "var(--color-notion-text-tertiary)" }}
          >
            Loading instances…
          </span>
        </div>
      )}

      {/* Error */}
      {error !== undefined && !loading && (
        <Card>
          <div className="flex items-center gap-3 p-1">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--color-accent-red-bg)" }}
            >
              <AlertCircle
                size={18}
                style={{ color: "var(--color-accent-red)" }}
              />
            </div>
            <span
              className="flex-1 text-sm"
              style={{ color: "var(--color-accent-red)" }}
            >
              {error}
            </span>
            <Button size="sm" variant="secondary" onClick={refetch}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Instance grid */}
      {!loading && error === undefined && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Ghost card for modpack being installed (not yet in DB) */}
          {showGhostCard && installProgress !== undefined && (
            <InstallingCard progress={installProgress} />
          )}

          {activeInstances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              onPlay={launch}
              onDelete={setDeleteConfirmId}
              installProgress={installProgress}
              gameStatus={gameStatus}
              actionsDisabled={actionsLocked}
              showLaunchDownload={
                isDownloadingBeforeLaunch && activeInstanceId === instance.id
              }
              launchDownloadProgress={downloadProgress}
            />
          ))}

          {/* Add instance card */}
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true);
            }}
            className="flex min-h-[220px] items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200 hover:bg-[var(--color-notion-bg-hover)] hover:text-[var(--color-notion-text-secondary)]"
            style={{
              borderColor: "var(--color-notion-border)",
              background: "var(--color-notion-bg-secondary)",
              color: "var(--color-notion-text-tertiary)",
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-notion-bg-tertiary)] transition-colors">
                <Plus size={24} />
              </div>
              <span className="text-sm font-semibold">Add Instance</span>
            </div>
          </button>
        </div>
      )}

      {launchError !== undefined && (
        <Card>
          <div className="flex items-center gap-3 p-1">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--color-accent-red-bg)" }}
            >
              <AlertCircle
                size={18}
                style={{ color: "var(--color-accent-red)" }}
              />
            </div>
            <span
              className="text-sm"
              style={{ color: "var(--color-accent-red)" }}
            >
              {launchError}
            </span>
          </div>
        </Card>
      )}

      {!isJavaReady && (
        <Card>
          <div className="flex items-center gap-3 p-1">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--color-accent-yellow-bg)" }}
            >
              <AlertCircle
                size={18}
                style={{ color: "var(--color-accent-yellow)" }}
              />
            </div>
            <span
              className="text-sm"
              style={{ color: "var(--color-accent-yellow)" }}
            >
              Java 21 n&apos;est pas prêt. Termine l&apos;installation via la
              popup avant de lancer une instance.
            </span>
          </div>
        </Card>
      )}

      {isDownloadingBeforeLaunch && downloadProgress !== undefined && (
        <Card>
          <div className="flex flex-col gap-3 p-1">
            <div className="flex items-center gap-2">
              <Loader2
                size={16}
                className="animate-spin"
                style={{ color: "var(--color-notion-text-tertiary)" }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--color-notion-text-secondary)" }}
              >
                Téléchargement Minecraft en cours avant lancement…
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--color-notion-bg-tertiary)" }}
            >
              <div
                className="h-full rounded-full bg-[var(--color-accent-blue)] transition-all duration-300"
                style={{
                  width: `${String(getDownloadPercent(downloadProgress))}%`,
                }}
              />
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--color-notion-text-tertiary)" }}
            >
              {getDownloadPercent(downloadProgress).toFixed(0)}%
            </span>
          </div>
        </Card>
      )}

      {isGameCrashedStatus(gameStatus) && (
        <Card>
          <div className="flex items-center gap-3 p-1">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--color-accent-red-bg)" }}
            >
              <AlertCircle
                size={18}
                style={{ color: "var(--color-accent-red)" }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <span
                className="text-sm font-medium"
                style={{ color: "var(--color-accent-red)" }}
              >
                Crash au lancement
                {gameStatus.crashed.exit_code !== null
                  ? ` (code ${String(gameStatus.crashed.exit_code)})`
                  : ""}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--color-accent-red)" }}
              >
                {gameStatus.crashed.message}
              </span>
            </div>
            <Button size="sm" variant="danger" onClick={handleOpenCrashModal}>
              Voir les logs
            </Button>
          </div>
        </Card>
      )}

      {/* Empty state — hidden when ghost card is visible */}
      {!loading &&
        error === undefined &&
        activeInstances.length === 0 &&
        !showGhostCard && (
          <div
            className="flex flex-col items-center justify-center py-16"
            style={{ color: "var(--color-notion-text-tertiary)" }}
          >
            <div
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-lg"
              style={{ background: "var(--color-notion-bg-tertiary)" }}
            >
              <Gamepad2
                size={36}
                style={{ color: "var(--color-notion-text-disabled)" }}
              />
            </div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-notion-text-tertiary)" }}
            >
              No instances yet
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: "var(--color-notion-text-tertiary)" }}
            >
              Create your first modpack to get started!
            </p>
          </div>
        )}

      {/* Create modal */}
      <CreateInstanceModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
        }}
        onCreated={refetch}
      />

      {/* Delete confirmation */}
      <Modal
        open={deleteConfirmId !== undefined}
        onClose={() => {
          setDeleteConfirmId(undefined);
        }}
        title="Delete Instance"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeleteConfirmId(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={deleting || actionsLocked}
              onClick={handleDelete}
              icon={
                deleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )
              }
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p
          className="text-sm"
          style={{ color: "var(--color-notion-text-secondary)" }}
        >
          Are you sure? This will permanently delete the instance and all its
          data. This action cannot be undone.
        </p>
      </Modal>

      {/* Crash log modal */}
      <CrashLogModal
        open={crashModalOpen}
        onClose={handleCloseCrashModal}
        crashLog={crashLog}
        loading={crashLogLoading}
      />
    </div>
  );
}
