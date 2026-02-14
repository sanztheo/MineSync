import {
  type ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Boxes,
  X,
} from "@/components/ui/PixelIcon";
import {
  getModVersions,
  installModpack,
  getInstallProgress,
} from "@/lib/tauri";
import type {
  ModSearchResult,
  ModVersionInfo,
  InstallProgress,
  InstallStage,
  MinecraftInstance,
} from "@/lib/types";

const POLL_INTERVAL_MS = 500;

interface InstallModpackModalProps {
  open: boolean;
  onClose: () => void;
  modpack: ModSearchResult;
  onInstalled: (instance: MinecraftInstance) => void;
}

type Step = "select_version" | "installing" | "done" | "error";

function stageLabel(stage: InstallStage): string {
  switch (stage.type) {
    case "fetching_info":
      return "Fetching modpack info…";
    case "downloading_pack":
      return "Downloading modpack archive…";
    case "extracting_pack":
      return "Extracting archive…";
    case "creating_instance":
      return "Creating instance…";
    case "downloading_minecraft":
      return "Downloading Minecraft…";
    case "installing_loader":
      return "Installing mod loader…";
    case "resolving_mods":
      return "Resolving mod downloads…";
    case "downloading_mods":
      return `Downloading mods (${String(stage.current)}/${String(stage.total)})…`;
    case "copying_overrides":
      return "Copying overrides…";
    case "registering_mods":
      return "Registering mods…";
    case "completed":
      return "Installation complete!";
    case "failed":
      return `Failed: ${stage.message}`;
  }
}

export function InstallModpackModal({
  open,
  onClose,
  modpack,
  onInstalled,
}: InstallModpackModalProps): ReactNode {
  const [step, setStep] = useState<Step>("select_version");
  const [versions, setVersions] = useState<ModVersionInfo[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [progress, setProgress] = useState<InstallProgress | undefined>(
    undefined,
  );
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Fetch versions when modal opens
  useEffect(() => {
    if (!open) {
      setStep("select_version");
      setVersions([]);
      setProgress(undefined);
      setErrorMsg(undefined);
      return;
    }

    setLoadingVersions(true);
    getModVersions({
      source: modpack.source,
      projectId: modpack.id,
    })
      .then((v) => {
        setVersions(v);
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoadingVersions(false);
      });
  }, [open, modpack.source, modpack.id]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current !== undefined) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  const startInstall = useCallback(
    async (version: ModVersionInfo): Promise<void> => {
      setStep("installing");
      setErrorMsg(undefined);

      // Start polling progress
      pollRef.current = setInterval(() => {
        getInstallProgress()
          .then((p) => {
            setProgress(p);
          })
          .catch(() => {
            // Ignore poll errors
          });
      }, POLL_INTERVAL_MS);

      try {
        const installedInstance = await installModpack({
          source: modpack.source,
          projectId: modpack.id,
          versionId: version.id,
          modpackName: modpack.name,
          modpackIconUrl: modpack.icon_url,
          modpackDescription: modpack.description,
        });
        setStep("done");
        onInstalled(installedInstance);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStep("error");
      } finally {
        if (pollRef.current !== undefined) {
          clearInterval(pollRef.current);
          pollRef.current = undefined;
        }
      }
    },
    [
      modpack.source,
      modpack.id,
      modpack.name,
      modpack.icon_url,
      modpack.description,
      onInstalled,
    ],
  );

  const handleClose = useCallback((): void => {
    onClose();
  }, [onClose]);

  return (
    <Modal
      open={open}
      onClose={step === "installing" ? () => {} : handleClose}
      title={`Install ${modpack.name}`}
    >
      <div className="flex flex-col gap-4">
        {/* Modpack info header */}
        <div
          className="flex items-start gap-3 rounded-md p-3"
          style={{
            background: "var(--color-notion-bg)",
            border: "1px solid var(--color-notion-border-light)",
          }}
        >
          {modpack.icon_url !== undefined ? (
            <img
              src={modpack.icon_url}
              alt={modpack.name}
              className="h-12 w-12 shrink-0 rounded-md object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
              style={{ background: "var(--color-notion-bg-hover)" }}
            >
              <Boxes
                size={20}
                style={{ color: "var(--color-notion-text-tertiary)" }}
              />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
            <h3
              className="truncate text-sm font-semibold"
              style={{ color: "var(--color-notion-text)" }}
            >
              {modpack.name}
            </h3>
            <span
              className="text-xs"
              style={{ color: "var(--color-notion-text-secondary)" }}
            >
              by {modpack.author}
            </span>
            {modpack.description !== "" && (
              <p
                className="line-clamp-2 text-xs"
                style={{ color: "var(--color-notion-text-tertiary)" }}
              >
                {modpack.description}
              </p>
            )}
          </div>
        </div>

        {/* Version selection */}
        {step === "select_version" && (
          <>
            <p
              className="text-sm"
              style={{ color: "var(--color-notion-text-secondary)" }}
            >
              Select a version to install:
            </p>

            {loadingVersions && (
              <div className="flex items-center justify-center py-6">
                <Loader2
                  size={20}
                  className="animate-spin"
                  style={{ color: "var(--color-notion-text-tertiary)" }}
                />
                <span
                  className="ml-2 text-sm"
                  style={{ color: "var(--color-notion-text-secondary)" }}
                >
                  Loading versions…
                </span>
              </div>
            )}

            {!loadingVersions && versions.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <div className="flex flex-col gap-0.5">
                  {versions.slice(0, 20).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        startInstall(v);
                      }}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--color-notion-bg-hover)]"
                    >
                      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                        <span
                          className="truncate text-sm font-medium"
                          style={{ color: "var(--color-notion-text)" }}
                        >
                          {v.name}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {v.game_versions.slice(0, 3).map((gv) => (
                            <Badge key={gv} variant="default">
                              {gv}
                            </Badge>
                          ))}
                          {v.loaders.map((l) => (
                            <Badge key={l} variant="info">
                              {l}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        style={{ color: "var(--color-notion-text-disabled)" }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loadingVersions && versions.length === 0 && (
              <p
                className="py-4 text-center text-sm"
                style={{ color: "var(--color-notion-text-secondary)" }}
              >
                No versions found
              </p>
            )}

            {errorMsg !== undefined && (
              <div
                className="flex items-center gap-2 rounded-md p-3"
                style={{
                  background: "var(--color-accent-red-bg)",
                }}
              >
                <AlertCircle
                  size={16}
                  style={{ color: "var(--color-accent-red)" }}
                />
                <span
                  className="text-xs"
                  style={{ color: "var(--color-accent-red)" }}
                >
                  {errorMsg}
                </span>
              </div>
            )}
          </>
        )}

        {/* Installing */}
        {step === "installing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: "var(--color-notion-text-tertiary)" }}
            />
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-notion-text)" }}
            >
              Installing modpack…
            </p>
            {progress !== undefined && (
              <>
                <p
                  className="text-xs"
                  style={{ color: "var(--color-notion-text-secondary)" }}
                >
                  {stageLabel(progress.stage)}
                </p>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--color-notion-bg-hover)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${String(Math.min(100, progress.overall_percent))}%`,
                      background: "var(--color-accent-blue)",
                    }}
                  />
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--color-notion-text-tertiary)" }}
                >
                  {progress.overall_percent.toFixed(0)}%
                </span>
              </>
            )}
            <p
              className="text-xs"
              style={{ color: "var(--color-notion-text-tertiary)" }}
            >
              You can close this dialog — installation continues in background.
            </p>
            <Button
              size="sm"
              variant="ghost"
              icon={<X size={14} />}
              onClick={handleClose}
            >
              Close
            </Button>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-md"
              style={{ background: "var(--color-accent-green-bg)" }}
            >
              <CheckCircle2
                size={28}
                style={{ color: "var(--color-accent-green)" }}
              />
            </div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-notion-text)" }}
            >
              Instance created successfully!
            </p>
            <Button size="sm" icon={<Download size={14} />} onClick={onClose}>
              Done
            </Button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-md"
              style={{ background: "var(--color-accent-red-bg)" }}
            >
              <AlertCircle
                size={28}
                style={{ color: "var(--color-accent-red)" }}
              />
            </div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-accent-red)" }}
            >
              Installation failed
            </p>
            {errorMsg !== undefined && (
              <p
                className="max-w-sm text-center text-xs"
                style={{ color: "var(--color-notion-text-secondary)" }}
              >
                {errorMsg}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
