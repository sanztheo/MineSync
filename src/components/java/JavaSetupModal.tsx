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
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4 backdrop-blur-[2px]"
      style={{ background: "rgba(0, 0, 0, 0.2)" }}
    >
      <div
        className="w-full max-w-lg p-6"
        style={{
          background: "var(--color-notion-bg)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-md-theme)",
        }}
      >
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--color-notion-text)" }}
        >
          Java requis
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--color-notion-text-secondary)" }}
        >
          MineSync a besoin de Java 21 pour lancer Minecraft. Clique sur le
          bouton pour installer automatiquement le runtime portable.
        </p>

        {errorMessage !== undefined && (
          <div
            className="mt-4 flex items-start gap-2 rounded-md px-3 py-2"
            style={{
              background: "var(--color-accent-red-bg)",
              color: "var(--color-accent-red)",
            }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="text-xs">{errorMessage}</span>
          </div>
        )}

        {status.status === "installing" && (
          <div
            className="mt-4 flex flex-col gap-2 rounded-md px-3 py-3"
            style={{
              background: "var(--color-notion-bg-secondary)",
              border: "1px solid var(--color-notion-border-light)",
            }}
          >
            <div className="flex items-center gap-2">
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: "var(--color-notion-text-tertiary)" }}
              />
              <span
                className="text-sm"
                style={{ color: "var(--color-notion-text-secondary)" }}
              >
                Installation Java ({stage ?? "working"})…
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{ background: "var(--color-notion-bg-hover)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${String(Math.min(100, progress))}%`,
                  background: "var(--color-accent-blue)",
                }}
              />
            </div>
            <div
              className="flex items-center justify-between text-[11px]"
              style={{ color: "var(--color-notion-text-tertiary)" }}
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
