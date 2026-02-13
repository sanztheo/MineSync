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
              style={{ color: "rgba(55, 53, 47, 0.85)" }}
            >
              {label}
            </span>
          )}
          {description !== undefined && (
            <span
              className="text-xs"
              style={{ color: "rgba(55, 53, 47, 0.45)" }}
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
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(35,131,226,0.3)] focus-visible:ring-offset-2"
        style={{
          background: checked ? "#222222" : "rgba(55, 53, 47, 0.16)",
        }}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200 ${
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
