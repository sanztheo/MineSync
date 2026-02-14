import type { ReactNode } from "react";
import { Minus, Square, Sun, Moon, X } from "@/components/ui/PixelIcon";
import { getCurrentWindow } from "@tauri-apps/api/window";
import logoSvg from "@/assets/logo.svg";
import { useTheme } from "@/hooks/use-theme";

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
      style={{ color: "var(--color-notion-text-tertiary)" }}
    >
      {children}
    </button>
  );
}

export function TitleBar(): ReactNode {
  const appWindow = getCurrentWindow();
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      data-tauri-drag-region
      className="flex shrink-0 items-center justify-between select-none"
      style={{
        height: "45px",
        background: "var(--color-notion-bg)",
        borderBottom: "1px solid var(--color-notion-border-light)",
      }}
    >
      <div data-tauri-drag-region className="flex items-center gap-2 pl-4">
        <img src={logoSvg} alt="MineSync" className="h-5 w-auto" />
      </div>

      <div className="ml-auto flex items-center">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="mr-2 rounded-md p-1.5 transition-colors duration-150 hover:bg-[var(--color-notion-bg-hover)]"
          style={{ color: "var(--color-notion-text-secondary)" }}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <WindowButton
          onClick={() => {
            appWindow.minimize();
          }}
          hoverClass="hover:bg-[var(--color-notion-bg-hover)]"
          ariaLabel="Minimize window"
        >
          <Minus size={14} />
        </WindowButton>
        <WindowButton
          onClick={() => {
            appWindow.toggleMaximize();
          }}
          hoverClass="hover:bg-[var(--color-notion-bg-hover)]"
          ariaLabel="Maximize window"
        >
          <Square size={10} />
        </WindowButton>
        <WindowButton
          onClick={() => {
            appWindow.close();
          }}
          hoverClass="hover:bg-[var(--color-accent-red-bg)] hover:text-[var(--color-accent-red)]"
          ariaLabel="Close window"
        >
          <X size={14} />
        </WindowButton>
      </div>
    </header>
  );
}
