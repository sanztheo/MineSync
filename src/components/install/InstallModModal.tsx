import {
  type ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Loader2, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { listInstances, getModVersions, installMod } from "@/lib/tauri";
import type {
  ModSearchResult,
  MinecraftInstance,
  ModVersionInfo,
  ModInfo,
} from "@/lib/types";

interface InstallModModalProps {
  open: boolean;
  onClose: () => void;
  mod: ModSearchResult;
}

type Step =
  | "select_instance"
  | "select_version"
  | "installing"
  | "done"
  | "error";

export function InstallModModal({
  open,
  onClose,
  mod: searchResult,
}: InstallModModalProps): ReactNode {
  const [step, setStep] = useState<Step>("select_instance");
  const [instances, setInstances] = useState<MinecraftInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<
    MinecraftInstance | undefined
  >(undefined);
  const [versions, setVersions] = useState<ModVersionInfo[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installedMod, setInstalledMod] = useState<ModInfo | undefined>(
    undefined,
  );
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep("select_instance");
      setSelectedInstance(undefined);
      setVersions([]);
      setInstalledMod(undefined);
      setErrorMsg(undefined);
      return;
    }

    // Load instances
    setLoadingInstances(true);
    listInstances()
      .then((i) => {
        setInstances(i);
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoadingInstances(false);
      });
  }, [open]);

  // Filtered versions based on selected instance's MC version + loader
  const filteredVersions = useMemo((): ModVersionInfo[] => {
    if (selectedInstance === undefined) return versions;

    return versions.filter((v) => {
      const matchesVersion =
        v.game_versions.length === 0 ||
        v.game_versions.includes(selectedInstance.minecraft_version);
      const matchesLoader =
        v.loaders.length === 0 ||
        v.loaders.some((l) => l.toLowerCase() === selectedInstance.loader);
      return matchesVersion && matchesLoader;
    });
  }, [versions, selectedInstance]);

  const selectInstance = useCallback(
    async (instance: MinecraftInstance): Promise<void> => {
      setSelectedInstance(instance);
      setStep("select_version");
      setLoadingVersions(true);
      setErrorMsg(undefined);

      try {
        const v = await getModVersions({
          source: searchResult.source,
          projectId: searchResult.id,
          gameVersion: instance.minecraft_version,
          loader: instance.loader !== "vanilla" ? instance.loader : undefined,
        });
        setVersions(v);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingVersions(false);
      }
    },
    [searchResult.source, searchResult.id],
  );

  const doInstall = useCallback(
    async (version: ModVersionInfo): Promise<void> => {
      if (selectedInstance === undefined) return;

      setStep("installing");
      setInstalling(true);
      setErrorMsg(undefined);

      try {
        const result = await installMod({
          instanceId: selectedInstance.id,
          source: searchResult.source,
          projectId: searchResult.id,
          versionId: version.id,
        });
        setInstalledMod(result);
        setStep("done");
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStep("error");
      } finally {
        setInstalling(false);
      }
    },
    [selectedInstance, searchResult.source, searchResult.id],
  );

  return (
    <Modal
      open={open}
      onClose={installing ? () => {} : onClose}
      title={`Install ${searchResult.name}`}
    >
      <div className="flex flex-col gap-4">
        {/* Step 1: Select instance */}
        {step === "select_instance" && (
          <>
            <p className="text-sm text-zinc-400">
              Select an instance to install this mod into:
            </p>

            {loadingInstances && (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-accent" />
                <span className="ml-2 text-sm text-zinc-500">
                  Loading instances...
                </span>
              </div>
            )}

            {!loadingInstances && instances.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <div className="flex flex-col gap-1">
                  {instances.map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => {
                        selectInstance(inst);
                      }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-600"
                    >
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-sm font-medium text-zinc-200">
                          {inst.name}
                        </span>
                        <div className="flex gap-1">
                          <Badge variant="default">
                            {inst.minecraft_version}
                          </Badge>
                          <Badge variant="info">{inst.loader}</Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loadingInstances && instances.length === 0 && (
              <p className="py-4 text-center text-sm text-zinc-500">
                No instances found. Create one first.
              </p>
            )}
          </>
        )}

        {/* Step 2: Select version */}
        {step === "select_version" && selectedInstance !== undefined && (
          <>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setStep("select_instance");
                }}
              >
                Back
              </Button>
              <span className="text-xs text-zinc-500">
                Installing into{" "}
                <strong className="text-zinc-300">
                  {selectedInstance.name}
                </strong>
              </span>
            </div>

            <p className="text-sm text-zinc-400">Select a version:</p>

            {loadingVersions && (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-accent" />
                <span className="ml-2 text-sm text-zinc-500">
                  Loading versions...
                </span>
              </div>
            )}

            {!loadingVersions && filteredVersions.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <div className="flex flex-col gap-1">
                  {filteredVersions.slice(0, 20).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        doInstall(v);
                      }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-600"
                    >
                      <Download size={14} className="shrink-0 text-zinc-500" />
                      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                        <span className="truncate text-sm font-medium text-zinc-200">
                          {v.name}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {v.game_versions.slice(0, 3).map((gv) => (
                            <Badge key={gv} variant="default">
                              {gv}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loadingVersions && filteredVersions.length === 0 && (
              <p className="py-4 text-center text-sm text-zinc-500">
                No compatible versions found for this instance
              </p>
            )}
          </>
        )}

        {/* Step 3: Installing */}
        {step === "installing" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={28} className="animate-spin text-accent" />
            <p className="text-sm text-zinc-300">Installing mod...</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 size={28} className="text-accent" />
            <p className="text-sm font-medium text-zinc-200">
              Mod installed successfully!
            </p>
            {installedMod !== undefined && (
              <p className="text-xs text-zinc-500">{installedMod.file_name}</p>
            )}
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm font-medium text-red-300">
              Installation failed
            </p>
            {errorMsg !== undefined && (
              <p className="max-w-sm text-center text-xs text-zinc-500">
                {errorMsg}
              </p>
            )}
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {/* General error (during loading) */}
        {errorMsg !== undefined && step === "select_instance" && (
          <div className="flex items-center gap-2 rounded-lg bg-red-950/30 p-3">
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-xs text-red-300">{errorMsg}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
