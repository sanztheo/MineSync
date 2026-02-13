import { type ReactNode, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  Plus,
  Play,
  RefreshCw,
  Loader2,
  AlertCircle,
  Gamepad2,
  Trash2,
  MoreVertical,
} from "lucide-react";
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
} from "@/lib/tauri";
import type {
  MinecraftInstance,
  ModLoader,
  VersionEntry,
  InstallProgress,
  InstallStage,
  DownloadProgress,
  GameStatus,
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
      return "Fetching info...";
    case "downloading_pack":
      return "Downloading pack...";
    case "extracting_pack":
      return "Extracting...";
    case "creating_instance":
      return "Creating...";
    case "downloading_minecraft":
      return "Downloading MC...";
    case "installing_loader":
      return "Installing loader...";
    case "resolving_mods":
      return "Resolving mods...";
    case "downloading_mods":
      return `Mods ${String(stage.current)}/${String(stage.total)}`;
    case "copying_overrides":
      return "Copying files...";
    case "registering_mods":
      return "Registering...";
    case "completed":
      return "Done!";
    case "failed":
      return "Failed";
  }
}

function getDownloadPercent(progress: DownloadProgress): number {
  if (progress.total_bytes <= 0) return 0;
  return Math.min(100, (progress.downloaded_bytes / progress.total_bytes) * 100);
}

function gameStatusBadge(
  status: GameStatus,
): { label: string; variant: "success" | "info" | "danger" } | undefined {
  if (isGameRunningStatus(status)) {
    return { label: "Running", variant: "success" };
  }
  if (isGamePreparingStatus(status)) {
    return { label: "Preparing...", variant: "info" };
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
          <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-lg bg-surface-600">
            {instance.icon_url !== undefined ? (
              <img
                src={instance.icon_url}
                alt={instance.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <Gamepad2 size={32} className="text-zinc-600" />
            )}

            {/* Installing overlay */}
            {isInstalling && installProgress !== undefined && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-surface-900/80">
                <Loader2 size={20} className="animate-spin text-accent" />
                <span className="text-[10px] font-medium text-zinc-300">
                  {shortStageLabel(installProgress.stage)}
                </span>
                <div className="mx-4 h-1.5 w-3/4 overflow-hidden rounded-full bg-surface-600">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{
                      width: `${String(Math.min(100, installProgress.overall_percent))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500">
                  {installProgress.overall_percent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-1">
            <h3 className="truncate font-semibold text-zinc-100">
              {instance.name}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant={LOADER_BADGE_VARIANT[instance.loader]}>
                {instance.loader}
              </Badge>
              <span className="text-xs text-zinc-500">
                {instance.minecraft_version}
              </span>
              {status !== undefined && (
                <Badge variant={status.variant}>{status.label}</Badge>
              )}
            </div>
            <span className="text-[10px] text-zinc-600">
              {isInstalling
                ? "Installing..."
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
                  Preparing launch...
                </Button>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-600">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${String(getDownloadPercent(launchDownloadProgress))}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500">
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
                  variant="ghost"
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
        <div className="absolute right-2 top-2">
          <button
            onClick={() => {
              setMenuOpen((prev) => !prev);
            }}
            className="rounded p-1 text-zinc-600 opacity-0 transition-all hover:bg-surface-500 hover:text-zinc-300 group-hover:opacity-100"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-36 rounded-lg border border-border-default bg-surface-700 py-1 shadow-xl">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(instance.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-surface-600"
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
        instancePath: `~/.minesync/instances/${name.trim().toLowerCase().replace(/\s+/g, "-")}`,
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
            {creating ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Instance name"
          placeholder="My Modpack"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-400">
            Minecraft version
          </span>
          {versionsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={14} className="animate-spin text-zinc-500" />
              <span className="text-xs text-zinc-500">Loading versions...</span>
            </div>
          ) : versionsError !== undefined ? (
            <div className="flex items-center gap-2 rounded-lg bg-red-900/20 px-3 py-2">
              <AlertCircle size={14} className="shrink-0 text-red-400" />
              <span className="text-xs text-red-300">{versionsError}</span>
              <button
                type="button"
                onClick={refetchVersions}
                className="ml-auto text-xs text-accent hover:underline"
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
              className="rounded-lg border border-border-default bg-surface-700 px-3 py-2 text-sm text-zinc-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
            >
              <option value="">Select version</option>
              {releaseVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-400">Mod loader</span>
          <select
            value={loader}
            onChange={(e) => {
              setLoader(e.target.value);
            }}
            className="rounded-lg border border-border-default bg-surface-700 px-3 py-2 text-sm text-zinc-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
          >
            {LOADER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error !== undefined && (
          <div className="flex items-center gap-2 rounded-lg bg-red-900/20 px-3 py-2">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-xs text-red-300">{error}</span>
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
  const { progress: installProgress } = useInstallProgress();
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

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">My Instances</h1>
          <p className="text-sm text-zinc-500">
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
          <Loader2 size={24} className="animate-spin text-accent" />
          <span className="ml-3 text-sm text-zinc-500">
            Loading instances...
          </span>
        </div>
      )}

      {/* Error */}
      {error !== undefined && !loading && (
        <Card className="border-red-900/30">
          <div className="flex items-center gap-3 p-4">
            <AlertCircle size={18} className="shrink-0 text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
            <Button size="sm" variant="secondary" onClick={refetch}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* Instance grid */}
      {!loading && error === undefined && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border-hover bg-transparent text-zinc-600 transition-colors hover:border-accent hover:text-accent"
          >
            <div className="flex flex-col items-center gap-2">
              <Plus size={24} />
              <span className="text-sm font-medium">Add Instance</span>
            </div>
          </button>
        </div>
      )}

      {launchError !== undefined && (
        <Card className="border-red-900/30">
          <div className="flex items-center gap-3 p-4">
            <AlertCircle size={18} className="shrink-0 text-red-400" />
            <span className="text-sm text-red-300">{launchError}</span>
          </div>
        </Card>
      )}

      {!isJavaReady && (
        <Card className="border-amber-900/30">
          <div className="flex items-center gap-3 p-4">
            <AlertCircle size={18} className="shrink-0 text-amber-400" />
            <span className="text-sm text-amber-200">
              Java 21 n&apos;est pas prêt. Termine l&apos;installation via la
              popup avant de lancer une instance.
            </span>
          </div>
        </Card>
      )}

      {isDownloadingBeforeLaunch && downloadProgress !== undefined && (
        <Card>
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-accent" />
              <span className="text-sm text-zinc-300">
                Téléchargement Minecraft en cours avant lancement...
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-600">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${String(getDownloadPercent(downloadProgress))}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500">
              {getDownloadPercent(downloadProgress).toFixed(0)}%
            </span>
          </div>
        </Card>
      )}

      {isGameCrashedStatus(gameStatus) && (
        <Card className="border-red-900/30">
          <div className="flex items-center gap-3 p-4">
            <AlertCircle size={18} className="shrink-0 text-red-400" />
            <span className="text-sm text-red-300">
              Crash au lancement
              {gameStatus.crashed.exit_code !== null
                ? ` (code ${String(gameStatus.crashed.exit_code)})`
                : ""}
              : {gameStatus.crashed.message}
            </span>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!loading && error === undefined && activeInstances.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
          <Gamepad2 size={48} className="mb-4 text-zinc-700" />
          <p className="text-sm font-medium">No instances yet</p>
          <p className="text-xs text-zinc-700">
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
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-400">
          Are you sure? This will permanently delete the instance and all its
          data. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
