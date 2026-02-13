import { type ReactNode, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  RefreshCw,
  Share2,
  ArrowDownToLine,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  ArrowUpDown,
  AlertTriangle,
  History,
} from "@/components/ui/PixelIcon";
import {
  startP2p,
  stopP2p,
  getP2pStatus,
  shareModpack,
  joinViaCode,
  listInstances,
} from "@/lib/tauri";
import { useTauriCommand } from "@/hooks/use-tauri";
import type {
  P2pStatus,
  MinecraftInstance,
  ManifestDiff,
  ModUpdate,
} from "@/lib/types";

// --- Constants ---

const SHARE_CODE_PATTERN = /^MINE-[A-Z0-9]{6}$/;

// --- Sub-components ---

function P2pStatusBar({
  status,
  onStart,
  onStop,
  toggling,
}: {
  status: P2pStatus | undefined;
  onStart: () => void;
  onStop: () => void;
  toggling: boolean;
}): ReactNode {
  const isRunning = status?.is_running === true;

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          {isRunning ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[rgba(221,237,234,1)]">
              <Wifi size={16} className="text-[#0F7B6C]" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[rgba(55,53,47,0.04)]">
              <WifiOff size={16} className="text-gray-400" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {isRunning ? "P2P Connected" : "P2P Offline"}
            </p>
            {isRunning && status?.peer_id !== "" && (
              <p className="font-mono text-[10px] text-gray-400">
                {status?.peer_id.slice(0, 16)}…
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={isRunning ? "danger" : "primary"}
          disabled={toggling}
          onClick={isRunning ? onStop : onStart}
          icon={
            toggling ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isRunning ? (
              <WifiOff size={14} />
            ) : (
              <Wifi size={14} />
            )
          }
        >
          {toggling ? "Connecting…" : isRunning ? "Disconnect" : "Connect"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ShareSection({
  p2pRunning,
  instances,
}: {
  p2pRunning: boolean;
  instances: MinecraftInstance[];
}): ReactNode {
  const [selectedInstance, setSelectedInstance] = useState("");
  const [shareCode, setShareCode] = useState<string | undefined>(undefined);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleShare = useCallback(async (): Promise<void> => {
    if (selectedInstance === "") return;
    setSharing(true);
    setError(undefined);
    try {
      const code = await shareModpack(selectedInstance);
      setShareCode(code);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSharing(false);
    }
  }, [selectedInstance]);

  const handleCopy = useCallback(async (): Promise<void> => {
    if (shareCode === undefined) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard API not available
    }
  }, [shareCode]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[rgba(221,237,234,1)]">
            <Share2 size={16} className="text-[#0F7B6C]" />
          </div>
          <h3 className="font-semibold text-gray-800">Share Modpack</h3>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">
          Share your mod setup with friends. They&apos;ll get a code to join and
          sync.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Instance</span>
          <select
            value={selectedInstance}
            onChange={(e) => {
              setSelectedInstance(e.target.value);
              setShareCode(undefined);
            }}
            disabled={!p2pRunning}
            className="rounded-[5px] bg-white px-3.5 py-2.5 text-sm disabled:opacity-50"
            style={{
              border: "1px solid rgba(55, 53, 47, 0.16)",
              color: "rgba(55, 53, 47, 0.85)",
            }}
          >
            <option value="">Select an instance…</option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} — {inst.minecraft_version}
              </option>
            ))}
          </select>
        </div>

        {shareCode !== undefined ? (
          <div
            className="flex items-center gap-2 rounded-lg px-4 py-3"
            style={{
              border: "1px solid rgba(55, 53, 47, 0.16)",
              background: "rgba(55, 53, 47, 0.04)",
            }}
          >
            <span
              className="flex-1 text-center font-mono text-lg font-bold tracking-widest"
              style={{ color: "rgba(55, 53, 47, 1)" }}
            >
              {shareCode}
            </span>
            <button
              onClick={handleCopy}
              aria-label="Copy share code"
              className="rounded-lg p-1.5 transition-colors hover:bg-[rgba(55,53,47,0.08)]"
              style={{ color: "rgba(55, 53, 47, 0.65)" }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        ) : (
          <Button
            size="sm"
            disabled={!p2pRunning || selectedInstance === "" || sharing}
            onClick={handleShare}
            icon={
              sharing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Share2 size={14} />
              )
            }
          >
            {sharing ? "Generating…" : "Generate Share Code"}
          </Button>
        )}

        {error !== undefined && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2">
            <AlertCircle size={14} className="text-red-500" />
            <span className="text-xs text-red-600">{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JoinSection({ p2pRunning }: { p2pRunning: boolean }): ReactNode {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState(false);

  const isValidCode = SHARE_CODE_PATTERN.test(code.toUpperCase());

  const handleJoin = useCallback(async (): Promise<void> => {
    if (!isValidCode) return;
    setJoining(true);
    setError(undefined);
    try {
      await joinViaCode(code.toUpperCase());
      setSuccess(true);
      setCode("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setJoining(false);
    }
  }, [code, isValidCode]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[rgba(55,53,47,0.04)]">
            <ArrowDownToLine size={16} className="text-[#222222]" />
          </div>
          <h3 className="font-semibold text-gray-800">Join Session</h3>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">
          Enter a share code from a friend to download their mod setup.
        </p>

        <div className="flex items-end gap-2">
          <Input
            label="Share code"
            placeholder="MINE-XXXXXX"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setSuccess(false);
              setError(undefined);
            }}
            disabled={!p2pRunning}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!p2pRunning || !isValidCode || joining}
            onClick={handleJoin}
            icon={
              joining ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowDownToLine size={14} />
              )
            }
          >
            {joining ? "Joining…" : "Join"}
          </Button>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-md bg-[rgba(221,237,234,1)] px-3 py-2">
            <Check size={14} className="text-[#0F7B6C]" />
            <span className="text-xs text-[#0F7B6C]">
              Connected! Waiting for sync data…
            </span>
          </div>
        )}

        {error !== undefined && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2">
            <AlertCircle size={14} className="text-red-500" />
            <span className="text-xs text-red-600">{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DiffPreviewModal({
  open,
  onClose,
  diff,
  onConfirm,
  onReject,
  confirming,
}: {
  open: boolean;
  onClose: () => void;
  diff: ManifestDiff | undefined;
  onConfirm: () => void;
  onReject: () => void;
  confirming: boolean;
}): ReactNode {
  if (diff === undefined) return undefined;

  const addCount = diff.to_add.length;
  const removeCount = diff.to_remove.length;
  const updateCount = diff.to_update.length;
  const hasChanges = addCount > 0 || removeCount > 0 || updateCount > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sync Preview"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onReject}>
            Reject
          </Button>
          <Button
            size="sm"
            disabled={confirming || !hasChanges}
            onClick={onConfirm}
            icon={
              confirming ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )
            }
          >
            {confirming ? "Syncing…" : "Confirm Sync"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {diff.version_mismatch !== undefined && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2">
            <AlertTriangle
              size={14}
              className="mt-0.5 shrink-0 text-amber-500"
            />
            <div className="text-xs text-amber-700">
              <p className="font-semibold">Version mismatch</p>
              <p>
                Local: {diff.version_mismatch.local_mc_version}
                {diff.version_mismatch.local_loader !== undefined &&
                  ` (${diff.version_mismatch.local_loader})`}
              </p>
              <p>
                Remote: {diff.version_mismatch.remote_mc_version}
                {diff.version_mismatch.remote_loader !== undefined &&
                  ` (${diff.version_mismatch.remote_loader})`}
              </p>
            </div>
          </div>
        )}

        {!hasChanges && (
          <p className="text-center text-sm text-gray-500">
            Everything is already in sync!
          </p>
        )}

        {addCount > 0 && (
          <DiffSection
            title={`${String(addCount)} mod${addCount > 1 ? "s" : ""} to add`}
            icon={<Plus size={14} className="text-[#0F7B6C]" />}
            items={diff.to_add.map((m) => m.mod_name)}
            variant="add"
          />
        )}

        {removeCount > 0 && (
          <DiffSection
            title={`${String(removeCount)} mod${removeCount > 1 ? "s" : ""} to remove`}
            icon={<Minus size={14} className="text-red-500" />}
            items={diff.to_remove.map((m) => m.mod_name)}
            variant="remove"
          />
        )}

        {updateCount > 0 && <UpdateSection updates={diff.to_update} />}
      </div>
    </Modal>
  );
}

function DiffSection({
  title,
  icon,
  items,
  variant,
}: {
  title: string;
  icon: ReactNode;
  items: string[];
  variant: "add" | "remove";
}): ReactNode {
  const addStyles = {
    background: "rgba(221,237,234,0.7)",
    color: "#0F7B6C",
  };
  const removeStyles = {
    background: "rgba(253, 231, 233, 0.7)",
    color: "#dc2626",
  };
  const style = variant === "add" ? addStyles : removeStyles;

  return (
    <div
      className="rounded-md px-3 py-2"
      style={{ background: style.background }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-semibold" style={{ color: style.color }}>
          {title}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {items.map((name) => (
          <li key={name} className="text-xs text-gray-600">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpdateSection({ updates }: { updates: ModUpdate[] }): ReactNode {
  return (
    <div className="rounded-md bg-amber-50/70 px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <ArrowUpDown size={14} className="text-amber-500" />
        <span className="text-xs font-semibold text-amber-600">
          {updates.length} mod{updates.length > 1 ? "s" : ""} to update
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {updates.map((u) => (
          <li key={u.mod_name} className="text-xs text-gray-600">
            {u.mod_name}{" "}
            <span className="text-gray-400">
              {u.local_version} → {u.remote_version}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SyncHistoryPlaceholder(): ReactNode {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <History size={16} className="text-gray-500" />
        <h2 className="text-lg font-bold text-gray-800">Sync History</h2>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-10 text-gray-400">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-gray-100">
          <History size={24} className="text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">No sync history yet</p>
        <p className="text-xs text-gray-400">
          Share or join a session to get started
        </p>
      </div>
    </div>
  );
}

// --- Main ---

export function SyncHub(): ReactNode {
  const [p2pStatus, setP2pStatus] = useState<P2pStatus | undefined>(undefined);
  const [toggling, setToggling] = useState(false);
  const [diffPreview, setDiffPreview] = useState<ManifestDiff | undefined>(
    undefined,
  );
  const [diffOpen, setDiffOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const initialFetchDone = useRef(false);

  const { data: instances } =
    useTauriCommand<MinecraftInstance[]>(listInstances);

  // Fetch initial P2P status on mount
  const fetchP2pStatus = useCallback(async (): Promise<void> => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    try {
      const status = await getP2pStatus();
      setP2pStatus(status);
    } catch {
      // P2P service may not be available yet
    }
  }, []);

  // Trigger initial fetch
  useTauriCommand(fetchP2pStatus);

  const handleStartP2p = useCallback(async (): Promise<void> => {
    setToggling(true);
    try {
      const status = await startP2p();
      setP2pStatus(status);
    } catch {
      // Start failed
    } finally {
      setToggling(false);
    }
  }, []);

  const handleStopP2p = useCallback(async (): Promise<void> => {
    setToggling(true);
    try {
      await stopP2p();
      setP2pStatus({ is_running: false, peer_id: "" });
    } catch {
      // Stop failed
    } finally {
      setToggling(false);
    }
  }, []);

  const handleConfirmSync = useCallback(async (): Promise<void> => {
    setConfirming(true);
    try {
      setDiffOpen(false);
      setDiffPreview(undefined);
    } finally {
      setConfirming(false);
    }
  }, []);

  const handleRejectSync = useCallback((): void => {
    setDiffOpen(false);
    setDiffPreview(undefined);
  }, []);

  const p2pRunning = p2pStatus?.is_running === true;

  return (
    <div className="flex flex-1 flex-col gap-6 p-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sync Hub</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Synchronize mods with friends via P2P
        </p>
      </div>

      {/* P2P Status */}
      <P2pStatusBar
        status={p2pStatus}
        onStart={handleStartP2p}
        onStop={handleStopP2p}
        toggling={toggling}
      />

      {/* P2P not running hint */}
      {!p2pRunning && !toggling && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 px-4 py-3">
          <AlertTriangle size={14} className="shrink-0 text-amber-500" />
          <span className="text-xs font-medium text-amber-700">
            Connect to P2P network to share or join sync sessions.
          </span>
        </div>
      )}

      {/* Share / Join cards */}
      <div className="grid gap-5 md:grid-cols-2">
        <ShareSection p2pRunning={p2pRunning} instances={instances ?? []} />
        <JoinSection p2pRunning={p2pRunning} />
      </div>

      {/* Sync history */}
      <SyncHistoryPlaceholder />

      {/* Diff preview modal */}
      <DiffPreviewModal
        open={diffOpen}
        onClose={handleRejectSync}
        diff={diffPreview}
        onConfirm={handleConfirmSync}
        onReject={handleRejectSync}
        confirming={confirming}
      />
    </div>
  );
}
