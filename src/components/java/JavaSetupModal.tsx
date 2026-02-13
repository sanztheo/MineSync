import type { ReactNode } from "react";
import { AlertCircle, Download, Loader2 } from "@/components/ui/PixelIcon";
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 px-4 backdrop-blur-[2px]">
      <div
        className="w-full max-w-lg bg-white p-6"
        style={{
          borderRadius: "12px",
          boxShadow:
            "rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 5px 10px, rgba(15, 15, 15, 0.2) 0px 15px 40px",
        }}
      >
        <h2
          className="text-lg font-bold"
          style={{ color: "rgba(55, 53, 47, 1)" }}
        >
          Java requis
        </h2>
        <p className="mt-2 text-sm" style={{ color: "rgba(55, 53, 47, 0.65)" }}>
          MineSync a besoin de Java 21 pour lancer Minecraft. Clique sur le
          bouton pour installer automatiquement le runtime portable.
        </p>

        {errorMessage !== undefined && (
          <div
            className="mt-4 flex items-start gap-2 rounded-md px-3 py-2"
            style={{ background: "rgba(251, 236, 221, 1)", color: "#E03E3E" }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="text-xs">{errorMessage}</span>
          </div>
        )}

        {status.status === "installing" && (
          <div
            className="mt-4 flex flex-col gap-2 rounded-md px-3 py-3"
            style={{
              background: "rgba(247, 246, 243, 1)",
              border: "1px solid rgba(55, 53, 47, 0.09)",
            }}
          >
            <div className="flex items-center gap-2">
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: "rgba(55, 53, 47, 0.45)" }}
              />
              <span
                className="text-sm"
                style={{ color: "rgba(55, 53, 47, 0.65)" }}
              >
                Installation Java ({stage ?? "working"})…
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: "rgba(55, 53, 47, 0.08)" }}
            >
              <div
                className="h-full rounded-full bg-[#222222] transition-all duration-300"
                style={{ width: `${String(Math.min(100, progress))}%` }}
              />
            </div>
            <div
              className="flex items-center justify-between text-[11px]"
              style={{ color: "rgba(55, 53, 47, 0.45)" }}
            >
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
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )
            }
            disabled={isInstalling}
            onClick={() => {
              void installJava();
            }}
          >
            {isInstalling ? "Installation…" : "Installer Java 21"}
          </Button>
        </div>
      </div>
    </div>
  );
}
