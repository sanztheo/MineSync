import type { ReactNode } from "react";
import { Minus, Square, X } from "@/components/ui/PixelIcon";
import { getCurrentWindow } from "@tauri-apps/api/window";
import logoSvg from "@/assets/logo.svg";

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
      className={`flex h-[45px] w-11 items-center justify-center transition-colors duration-150 ${hoverClass}`}
      style={{ color: "rgba(55, 53, 47, 0.45)" }}
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
      className="flex shrink-0 items-center justify-between bg-white select-none"
      style={{
        height: "45px",
        borderBottom: "1px solid rgba(55, 53, 47, 0.09)",
      }}
    >
      {/* Brand */}
      <div data-tauri-drag-region className="flex items-center pl-4">
        <img src={logoSvg} alt="MineSync" className="h-5 w-auto" />
      </div>

      {/* Window controls */}
      <div className="flex items-center">
        <WindowButton
          onClick={() => {
            appWindow.minimize();
          }}
          hoverClass="hover:bg-[rgba(55,53,47,0.06)]"
          ariaLabel="Minimize window"
        >
          <Minus size={14} />
        </WindowButton>
        <WindowButton
          onClick={() => {
            appWindow.toggleMaximize();
          }}
          hoverClass="hover:bg-[rgba(55,53,47,0.06)]"
          ariaLabel="Maximize window"
        >
          <Square size={10} />
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
