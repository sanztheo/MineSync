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
} from "lucide-react";
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
} from "@/lib/types";

const POLL_INTERVAL_MS = 500;

interface InstallModpackModalProps {
  open: boolean;
  onClose: () => void;
  modpack: ModSearchResult;
  onInstalled: () => void;
}

type Step = "select_version" | "installing" | "done" | "error";

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
        await installModpack({
          source: modpack.source,
          projectId: modpack.id,
          versionId: version.id,
          modpackName: modpack.name,
          modpackIconUrl: modpack.icon_url,
          modpackDescription: modpack.description,
        });
        setStep("done");
        onInstalled();
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
    <Modal open={open} onClose={handleClose} title={`Install ${modpack.name}`}>
      <div className="flex flex-col gap-4">
        {/* Modpack info header */}
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          {modpack.icon_url !== undefined ? (
            <img
              src={modpack.icon_url}
              alt={modpack.name}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100">
              <Boxes size={20} className="text-gray-400" />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
            <h3 className="truncate text-sm font-bold text-gray-900">
              {modpack.name}
            </h3>
            <span className="text-xs text-gray-500">by {modpack.author}</span>
            {modpack.description !== "" && (
              <p className="line-clamp-2 text-xs text-gray-400">
                {modpack.description}
              </p>
            )}
          </div>
        </div>

        {/* Version selection */}
        {step === "select_version" && (
          <>
            <p className="text-sm text-gray-600">
              Select a version to install:
            </p>

            {loadingVersions && (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-emerald-500" />
                <span className="ml-2 text-sm text-gray-500">
                  Loading versions\u2026
                </span>
              </div>
            )}

            {!loadingVersions && versions.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <div className="flex flex-col gap-1">
                  {versions.slice(0, 20).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        startInstall(v);
                      }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-gray-50"
                    >
                      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                        <span className="truncate text-sm font-semibold text-gray-800">
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
                      <ChevronRight size={16} className="text-gray-300" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loadingVersions && versions.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">
                No versions found
              </p>
            )}

            {errorMsg !== undefined && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-xs text-red-600">{errorMsg}</span>
              </div>
            )}
          </>
        )}

        {/* Installing */}
        {step === "installing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 size={32} className="animate-spin text-emerald-500" />
            <p className="text-sm font-semibold text-gray-800">
              Installing modpack\u2026
            </p>
            {progress !== undefined && (
              <>
                <p className="text-xs text-gray-500">
                  {stageLabel(progress.stage)}
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300"
                    style={{
                      width: `${String(Math.min(100, progress.overall_percent))}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-400">
                  {progress.overall_percent.toFixed(0)}%
                </span>
              </>
            )}
            <p className="text-xs text-gray-400">
              You can close this dialog \u2014 installation continues in
              background.
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
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800">
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
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <p className="text-sm font-semibold text-red-600">
              Installation failed
            </p>
            {errorMsg !== undefined && (
              <p className="max-w-sm text-center text-xs text-gray-500">
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
