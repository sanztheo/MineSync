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
    ? "border-red-300 focus:border-red-400 focus:ring-red-200/50"
    : "border-gray-200 focus:border-accent focus:ring-accent/20";

  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        {icon !== undefined && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-inset placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-shadow duration-150 ${borderColor} ${icon !== undefined ? "pl-10" : ""} ${className}`}
          {...props}
        />
      </div>
      {hasError && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
