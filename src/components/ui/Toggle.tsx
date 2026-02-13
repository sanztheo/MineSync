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
            <span className="text-sm font-medium text-gray-800">{label}</span>
          )}
          {description !== undefined && (
            <span className="text-xs text-gray-500">{description}</span>
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
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 ${
          checked ? "bg-emerald-500 shadow-accent" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-button transition-transform duration-200 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
