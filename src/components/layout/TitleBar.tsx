import type { ReactNode } from "react";
import { Minus, Square, X, Boxes } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function WindowButton({
  onClick,
  hoverClass,
  children,
  ariaLabel,
}: {
  onClick: () => void;
  hoverClass: string;
  children: ReactNode;
  ariaLabel: string;
}): ReactNode {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex h-8 w-10 items-center justify-center text-gray-400 transition-colors ${hoverClass}`}
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
      className="flex h-11 shrink-0 items-center justify-between bg-white/80 backdrop-blur-md select-none"
      style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
    >
      {/* Brand */}
      <div data-tauri-drag-region className="flex items-center gap-2.5 pl-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-accent">
          <Boxes size={14} className="text-white" />
        </div>
        <span
          data-tauri-drag-region
          className="text-sm font-bold tracking-tight text-gray-800"
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
          hoverClass="hover:bg-gray-100 hover:text-gray-600"
          ariaLabel="Minimize window"
        >
          <Minus size={14} />
        </WindowButton>
        <WindowButton
          onClick={() => {
            appWindow.toggleMaximize();
          }}
          hoverClass="hover:bg-gray-100 hover:text-gray-600"
          ariaLabel="Maximize window"
        >
          <Square size={11} />
        </WindowButton>
        <WindowButton
          onClick={() => {
            appWindow.close();
          }}
          hoverClass="hover:bg-red-50 hover:text-red-500"
          ariaLabel="Close window"
        >
          <X size={14} />
        </WindowButton>
      </div>
    </header>
  );
}
