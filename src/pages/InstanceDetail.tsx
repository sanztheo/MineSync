import {
  type ReactNode,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  Package,
  FolderOpen,
  Trash2,
  Settings,
  Loader2,
  AlertCircle,
  Plus,
  Square,
} from "lucide-react";
import { useTauriCommand } from "@/hooks/use-tauri";
import { useInstallProgress } from "@/hooks/use-install-progress";
import {
  getCrashInfo,
  getRunningPid,
  isGameCrashedStatus,
  useGameStatus,
} from "@/hooks/use-game-status";
import { useJavaRuntime } from "@/hooks/use-java-runtime";
import {
  getInstance,
  deleteInstance,
  listInstanceMods,
  removeMod,
} from "@/lib/tauri";
import type {
  DownloadProgress,
  ModLoader,
  ModInfo,
  InstallStage,
} from "@/lib/types";

// --- Constants ---

type Tab = "mods" | "files" | "settings";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "mods", label: "Mods" },
  { id: "files", label: "Files" },
  { id: "settings", label: "Settings" },
];

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

// --- Helpers ---

function stageLabel(stage: InstallStage): string {
  switch (stage.type) {
    case "fetching_info":
      return "Fetching modpack info\u2026";
    case "downloading_pack":
      return "Downloading modpack archive\u2026";
    case "extracting_pack":
      return "Extracting archive\u2026";
    case "creating_instance":
      return "Creating instance\u2026";
    case "downloading_minecraft":
      return "Downloading Minecraft\u2026";
    case "installing_loader":
      return "Installing mod loader\u2026";
    case "resolving_mods":
      return "Resolving mod downloads\u2026";
    case "downloading_mods":
      return `Downloading mods (${String(stage.current)}/${String(stage.total)})\u2026`;
    case "copying_overrides":
      return "Copying overrides\u2026";
    case "registering_mods":
      return "Registering mods\u2026";
    case "completed":
      return "Installation complete!";
    case "failed":
      return `Failed: ${stage.message}`;
  }
}

function getDownloadPercent(progress: DownloadProgress): number {
  if (progress.total_bytes <= 0) return 0;
  return Math.min(
    100,
    (progress.downloaded_bytes / progress.total_bytes) * 100,
  );
}

// --- Sub-components ---

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}): ReactNode {
  return (
    <div
      className="flex gap-1 rounded-md p-1"
      style={{ background: "rgba(242, 241, 238, 1)" }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            onChange(tab.id);
          }}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-all duration-150 ${
            active === tab.id ? "bg-white" : "text-gray-500 hover:text-gray-700"
          }`}
          style={
            active === tab.id
              ? {
                  color: "rgba(55, 53, 47, 1)",
                  boxShadow:
                    "rgba(15,15,15,0.04) 0px 0px 0px 1px, rgba(15,15,15,0.06) 0px 2px 4px",
                }
              : undefined
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ModsTab({
  instanceId,
  actionsDisabled,
}: {
  instanceId: string;
  actionsDisabled: boolean;
}): ReactNode {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | undefined>(undefined);

  const fetchMods = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await listInstanceMods(instanceId);
      setMods(result);
    } catch {
      setMods([]);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchMods();
  }, [fetchMods]);

  const handleRemove = useCallback(
    async (modId: string): Promise<void> => {
      setRemoving(modId);
      try {
        await removeMod(modId);
        await fetchMods();
      } catch {
        // Silently handle
      } finally {
        setRemoving(undefined);
      }
    },
    [fetchMods],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Installed Mods{mods.length > 0 ? ` (${String(mods.length)})` : ""}
        </h3>
        {actionsDisabled ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus size={12} />}
            disabled
          >
            Add Mods
          </Button>
        ) : (
          <Link to="/mods">
            <Button size="sm" variant="secondary" icon={<Plus size={12} />}>
              Add Mods
            </Button>
          </Link>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2
            size={20}
            className="animate-spin"
            style={{ color: "rgba(55, 53, 47, 0.45)" }}
          />
          <span className="ml-2 text-sm text-gray-500">Loading mods\u2026</span>
        </div>
      )}

      {!loading && mods.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-10 text-gray-400"
          style={{ borderColor: "rgba(55, 53, 47, 0.16)" }}
        >
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100">
            <Package size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No mods installed</p>
          <p className="text-xs text-gray-400">
            Browse and add mods from CurseForge or Modrinth
          </p>
        </div>
      )}

      {!loading && mods.length > 0 && (
        <div className="flex flex-col gap-2">
          {mods.map((mod) => (
            <div
              key={mod.id}
              className="flex items-center gap-3 rounded-md bg-white px-3 py-2.5"
              style={{ border: "1px solid rgba(55, 53, 47, 0.09)" }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md"
                style={{ background: "rgba(35,131,226,0.1)" }}
              >
                <Package size={14} className="text-blue-500" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                <span className="truncate text-sm font-semibold text-gray-800">
                  {mod.name}
                </span>
                <span className="text-xs text-gray-400">{mod.file_name}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={actionsDisabled || removing === mod.id}
                icon={
                  removing === mod.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )
                }
                onClick={() => {
                  handleRemove(mod.id);
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilesTab({ instancePath }: { instancePath: string }): ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ background: "rgba(35,131,226,0.1)" }}
            >
              <FolderOpen size={14} className="text-blue-500" />
            </div>
            <h3 className="font-semibold text-gray-800">Instance Directory</h3>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-500">
            {instancePath}
          </p>
          <div>
            <Button
              size="sm"
              variant="secondary"
              icon={<FolderOpen size={14} />}
            >
              Open Folder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab(): ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100">
              <Settings size={14} className="text-gray-500" />
            </div>
            <h3 className="font-semibold text-gray-800">Instance Settings</h3>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Per-instance JVM arguments and RAM allocation coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main ---

export function InstanceDetail(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("mods");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { progress: installProgress } = useInstallProgress();
  const isInstalling = installProgress?.instance_id === id;
  const {
    status: gameStatus,
    launch,
    kill,
    isRunning,
    isPreparing,
    launchError,
    downloadProgress,
    isDownloadingBeforeLaunch,
    activeInstanceId,
  } = useGameStatus();
  const { isReady: isJavaReady } = useJavaRuntime();
  const isLaunchingThisInstance =
    isDownloadingBeforeLaunch && activeInstanceId === id;
  const runningPid = getRunningPid(gameStatus);
  const crashInfo = getCrashInfo(gameStatus);
  const modsActionsDisabled = isRunning || isPreparing;

  const fetchInstance = useCallback(() => getInstance(id ?? ""), [id]);
  const {
    data: instance,
    loading,
    error,
  } = useTauriCommand(fetchInstance, [id]);

  const loaderVariant = useMemo(
    () =>
      instance !== undefined
        ? LOADER_BADGE_VARIANT[instance.loader]
        : ("default" as const),
    [instance],
  );

  const handleDelete = useCallback(async (): Promise<void> => {
    if (id === undefined) return;
    setDeleting(true);
    try {
      await deleteInstance(id);
      navigate("/");
    } catch {
      // Delete failed
    } finally {
      setDeleting(false);
    }
  }, [id, navigate]);

  const handleLaunch = useCallback(async (): Promise<void> => {
    if (id === undefined) return;
    await launch(id);
  }, [id, launch]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: "rgba(55, 53, 47, 0.45)" }}
        />
        <span className="ml-3 text-sm text-gray-500">
          Loading instance\u2026
        </span>
      </div>
    );
  }

  // Error or not found
  if (error !== undefined || instance === undefined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-red-50">
          <AlertCircle size={32} className="text-red-500" />
        </div>
        <p className="text-sm text-gray-500">{error ?? "Instance not found"}</p>
        <Link to="/">
          <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />}>
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-7">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft size={18} />
        </Link>

        {/* Icon */}
        {instance.icon_url !== undefined && (
          <img
            src={instance.icon_url}
            alt={instance.name}
            className="h-11 w-11 shrink-0 rounded-md object-cover"
            loading="lazy"
          />
        )}

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{instance.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={loaderVariant}>{instance.loader}</Badge>
            <span className="text-sm text-gray-500">
              {instance.minecraft_version}
            </span>
          </div>
        </div>

        {/* Action buttons \u2014 or progress bar if installing */}
        {isInstalling && installProgress !== undefined ? (
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: "rgba(55, 53, 47, 0.45)" }}
                />
                <span className="text-sm font-semibold text-gray-700">
                  Installing\u2026
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {stageLabel(installProgress.stage)}
              </span>
              <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#222222] transition-all duration-300"
                  style={{
                    width: `${String(Math.min(100, installProgress.overall_percent))}%`,
                  }}
                />
              </div>
              <span className="text-[10px] font-medium text-gray-400">
                {installProgress.overall_percent.toFixed(0)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-2">
            {isPreparing && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2
                  size={12}
                  className="animate-spin"
                  style={{ color: "rgba(55, 53, 47, 0.45)" }}
                />
                <span>Preparing\u2026</span>
              </div>
            )}

            {isRunning && runningPid !== undefined && (
              <Badge variant="success">
                Running (PID {String(runningPid)})
              </Badge>
            )}

            {isGameCrashedStatus(gameStatus) && crashInfo !== undefined && (
              <Badge variant="danger">
                Crashed
                {crashInfo.exitCode !== null
                  ? ` (code ${String(crashInfo.exitCode)})`
                  : ""}
              </Badge>
            )}

            {isLaunchingThisInstance && downloadProgress !== undefined && (
              <div className="flex w-56 flex-col items-end gap-1">
                <span className="text-xs text-gray-500">
                  Downloading Minecraft files before launch\u2026
                </span>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#222222] transition-all duration-300"
                    style={{
                      width: `${String(getDownloadPercent(downloadProgress))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-medium text-gray-400">
                  {getDownloadPercent(downloadProgress).toFixed(0)}%
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                icon={<Play size={14} />}
                disabled={
                  isPreparing ||
                  isRunning ||
                  isDownloadingBeforeLaunch ||
                  !isJavaReady
                }
                onClick={handleLaunch}
              >
                Launch
              </Button>
              {isRunning && (
                <Button
                  variant="danger"
                  icon={<Square size={14} />}
                  onClick={() => {
                    void kill();
                  }}
                >
                  Kill
                </Button>
              )}
              <Button
                variant="secondary"
                icon={<RefreshCw size={14} />}
                disabled={modsActionsDisabled}
              >
                Sync
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {instance.description !== undefined && (
        <p className="text-sm text-gray-500">{instance.description}</p>
      )}

      {launchError !== undefined && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2">
          <AlertCircle size={14} className="text-red-500" />
          <span className="text-xs text-red-600">{launchError}</span>
        </div>
      )}

      {!isJavaReady && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2">
          <AlertCircle size={14} className="text-amber-500" />
          <span className="text-xs text-amber-700">
            Java 21 n&apos;est pas pr\u00eat. Termine l&apos;installation via la
            popup pour lancer cette instance.
          </span>
        </div>
      )}

      {isDownloadingBeforeLaunch &&
        !isLaunchingThisInstance &&
        downloadProgress !== undefined && (
          <div
            className="flex flex-col gap-1 rounded-md bg-white p-3"
            style={{ border: "1px solid rgba(55, 53, 47, 0.09)" }}
          >
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Loader2
                size={12}
                className="animate-spin"
                style={{ color: "rgba(55, 53, 47, 0.45)" }}
              />
              <span>
                T\u00e9l\u00e9chargement Minecraft en cours avant
                lancement\u2026
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#222222] transition-all duration-300"
                style={{
                  width: `${String(getDownloadPercent(downloadProgress))}%`,
                }}
              />
            </div>
            <span className="text-[10px] font-medium text-gray-400">
              {getDownloadPercent(downloadProgress).toFixed(0)}%
            </span>
          </div>
        )}

      {isGameCrashedStatus(gameStatus) && crashInfo !== undefined && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2">
          <AlertCircle size={14} className="text-red-500" />
          <span className="text-xs text-red-600">{crashInfo.message}</span>
        </div>
      )}

      {/* Tabs */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "mods" && (
        <ModsTab
          instanceId={instance.id}
          actionsDisabled={modsActionsDisabled}
        />
      )}
      {activeTab === "files" && (
        <FilesTab instancePath={instance.instance_path} />
      )}
      {activeTab === "settings" && <SettingsTab />}

      {/* Danger zone */}
      <Card className="border border-red-100">
        <CardHeader>
          <h3 className="font-semibold text-red-500">Danger Zone</h3>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Permanently delete this instance and all its data.
          </p>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 size={14} />}
            onClick={() => {
              setDeleteOpen(true);
            }}
          >
            Delete
          </Button>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
        }}
        title="Delete Instance"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeleteOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={deleting}
              onClick={handleDelete}
              icon={
                deleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )
              }
            >
              {deleting ? "Deleting\u2026" : "Delete Instance"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <strong>{instance.name}</strong>? This
          will remove all files including installed mods. This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
