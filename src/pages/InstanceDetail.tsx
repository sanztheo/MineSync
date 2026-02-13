import { type ReactNode, useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { useTauriCommand } from "@/hooks/use-tauri";
import { getInstance, deleteInstance } from "@/lib/tauri";
import type { ModLoader } from "@/lib/types";

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

// --- Sub-components ---

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}): ReactNode {
  return (
    <div className="flex gap-1 border-b border-border-default">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            onChange(tab.id);
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            active === tab.id
              ? "border-b-2 border-accent text-accent"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ModsTab(): ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Installed Mods</h3>
        <Link to="/mods">
          <Button size="sm" variant="secondary" icon={<Plus size={12} />}>
            Add Mods
          </Button>
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default py-10 text-zinc-600">
        <Package size={32} className="mb-2 text-zinc-700" />
        <p className="text-sm">No mods installed</p>
        <p className="text-xs text-zinc-700">
          Browse and add mods from CurseForge or Modrinth
        </p>
      </div>
    </div>
  );
}

function FilesTab({ instancePath }: { instancePath: string }): ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-zinc-400" />
            <h3 className="font-medium text-zinc-200">Instance Directory</h3>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="font-mono text-xs text-zinc-600">{instancePath}</p>
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
            <Settings size={16} className="text-zinc-400" />
            <h3 className="font-medium text-zinc-200">Instance Settings</h3>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
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

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
        <span className="ml-3 text-sm text-zinc-500">Loading instance...</span>
      </div>
    );
  }

  // Error or not found
  if (error !== undefined || instance === undefined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-zinc-400">{error ?? "Instance not found"}</p>
        <Link to="/">
          <Button variant="secondary" size="sm" icon={<ArrowLeft size={14} />}>
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-surface-600 hover:text-zinc-300"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-100">{instance.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={loaderVariant}>{instance.loader}</Badge>
            <span className="text-sm text-zinc-500">
              {instance.minecraft_version}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<Play size={14} />}>Launch</Button>
          <Button variant="secondary" icon={<RefreshCw size={14} />}>
            Sync
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "mods" && <ModsTab />}
      {activeTab === "files" && (
        <FilesTab instancePath={instance.instance_path} />
      )}
      {activeTab === "settings" && <SettingsTab />}

      {/* Danger zone */}
      <Card className="border-red-900/30">
        <CardHeader>
          <h3 className="font-medium text-red-400">Danger Zone</h3>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
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
              {deleting ? "Deleting..." : "Delete Instance"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-400">
          Are you sure you want to delete <strong>{instance.name}</strong>? This
          will remove all files including installed mods. This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
