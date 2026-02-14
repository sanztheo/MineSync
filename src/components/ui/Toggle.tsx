import type { ReactNode } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleProps): ReactNode {
  return (
    <label
      className={`flex items-center justify-between gap-4 ${disabled ? "opacity-40" : "cursor-pointer"}`}
    >
      {(label !== undefined || description !== undefined) && (
        <div className="flex flex-col">
          {label !== undefined && (
            <span
              className="text-sm font-medium"
              style={{ color: "var(--color-notion-text)" }}
            >
              {label}
            </span>
          )}
          {description !== undefined && (
            <span
              className="text-xs"
              style={{ color: "var(--color-notion-text-tertiary)" }}
            >
              {description}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-notion-bg)]"
        style={{
          background: checked
            ? "var(--color-accent-blue)"
            : "var(--color-notion-border)",
        }}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-[var(--color-notion-bg)] transition-transform duration-200 ${
            checked ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
          style={{
            boxShadow:
              "0 1px 2px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)",
          }}
        />
      </button>
    </label>
  );
}
