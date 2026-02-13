import type { ReactNode } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useJavaRuntime } from "@/hooks/use-java-runtime";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function JavaSetupModal(): ReactNode {
  const { status, installJava, isBlocking, isInstalling, errorMessage } =
    useJavaRuntime();

  if (!isBlocking) return undefined;

  const progress = status.status === "installing" ? status.percent : 0;
  const downloaded =
    status.status === "installing" ? status.downloaded_bytes : 0;
  const total = status.status === "installing" ? status.total_bytes : null;
  const stage = status.status === "installing" ? status.stage : undefined;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-gray-900">Java requis</h2>
        <p className="mt-2 text-sm text-gray-600">
          MineSync a besoin de Java 21 pour lancer Minecraft. Clique sur le
          bouton pour installer automatiquement le runtime portable.
        </p>

        {errorMessage !== undefined && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="text-xs">{errorMessage}</span>
          </div>
        )}

        {status.status === "installing" && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-emerald-500" />
              <span className="text-sm text-gray-600">
                Installation Java ({stage ?? "working"})\u2026
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300"
                style={{ width: `${String(Math.min(100, progress))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{progress.toFixed(0)}%</span>
              <span>
                {formatBytes(downloaded)}
                {total !== null ? ` / ${formatBytes(total)}` : ""}
              </span>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button
            icon={
              isInstalling ? (
                <Loader2 size={14} className="animate-spin text-emerald-500" />
              ) : (
                <Download size={14} />
              )
            }
            disabled={isInstalling}
            onClick={() => {
              void installJava();
            }}
          >
            {isInstalling ? "Installation\u2026" : "Installer Java 21"}
          </Button>
        </div>
      </div>
    </div>
  );
}
