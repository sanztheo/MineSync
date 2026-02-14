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

  const borderStyle = hasError
    ? "1px solid var(--color-accent-red)"
    : "1px solid var(--color-notion-border)";

  const focusBorderColor = hasError
    ? "var(--color-accent-red)"
    : "var(--color-accent-blue)";

  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label
          htmlFor={id}
          className="text-sm font-medium"
          style={{ color: "var(--color-notion-text)" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon !== undefined && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--color-notion-text-tertiary)" }}
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`w-full rounded-[5px] bg-[var(--color-notion-bg-secondary)] px-3 py-2 text-sm transition-shadow duration-150 placeholder:text-[var(--color-notion-text-tertiary)] focus:outline-none ${icon !== undefined ? "pl-10" : ""} ${className}`}
          style={{
            border: borderStyle,
            color: "var(--color-notion-text)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = `1px solid ${focusBorderColor}`;
            e.currentTarget.style.boxShadow =
              "0 0 0 3px var(--focus-ring-strong)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = borderStyle;
            e.currentTarget.style.boxShadow = "none";
          }}
          {...props}
        />
      </div>
      {hasError && (
        <span className="text-xs" style={{ color: "var(--color-accent-red)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
