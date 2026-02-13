import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({
  label,
  error,
  icon,
  className = "",
  id,
  ...props
}: InputProps): ReactNode {
  const hasError = error !== undefined;

  const borderColor = hasError
    ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
    : "border-border-default focus:border-accent focus:ring-accent/30";

  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label htmlFor={id} className="text-sm font-medium text-zinc-400">
          {label}
        </label>
      )}
      <div className="relative">
        {icon !== undefined && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`w-full rounded-lg border bg-surface-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 ${borderColor} ${icon !== undefined ? "pl-9" : ""} ${className}`}
          {...props}
        />
      </div>
      {hasError && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
