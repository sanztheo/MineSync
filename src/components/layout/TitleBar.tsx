import type { ReactNode } from "react";
import { Minus, Square, X, Boxes } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function WindowButton({
  onClick,
  hoverClass,
  children,
}: {
  onClick: () => void;
  hoverClass: string;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 w-10 items-center justify-center text-zinc-500 transition-colors ${hoverClass}`}
    >
      {children}
    </button>
  );
}

export function TitleBar(): ReactNode {
  const appWindow = getCurrentWindow();

  return (
    <header
      data-tauri-drag-region
      className="flex h-10 shrink-0 items-center justify-between border-b border-border-default bg-surface-900 select-none"
    >
      {/* Brand */}
      <div data-tauri-drag-region className="flex items-center gap-2 pl-4">
        <Boxes size={18} className="text-accent" />
        <span
          data-tauri-drag-region
          className="text-xs font-bold tracking-wide text-zinc-300"
        >
          MineSync
        </span>
      </div>

      {/* Window controls */}
      <div className="flex items-center">
        <WindowButton
          onClick={() => {
            appWindow.minimize();
          }}
          hoverClass="hover:bg-surface-600 hover:text-zinc-300"
        >
          <Minus size={14} />
        </WindowButton>
        <WindowButton
          onClick={() => {
            appWindow.toggleMaximize();
          }}
          hoverClass="hover:bg-surface-600 hover:text-zinc-300"
        >
          <Square size={11} />
        </WindowButton>
        <WindowButton
          onClick={() => {
            appWindow.close();
          }}
          hoverClass="hover:bg-red-600/80 hover:text-white"
        >
          <X size={14} />
        </WindowButton>
      </div>
    </header>
  );
}
