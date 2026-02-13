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
    ? "1px solid #E03E3E"
    : "1px solid rgba(55, 53, 47, 0.16)";

  const focusBorderColor = hasError ? "#E03E3E" : "rgba(35, 131, 226, 0.5)";

  return (
    <div className="flex flex-col gap-1.5">
      {label !== undefined && (
        <label
          htmlFor={id}
          className="text-sm font-medium"
          style={{ color: "rgba(55, 53, 47, 0.85)" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon !== undefined && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "rgba(55, 53, 47, 0.45)" }}
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`w-full rounded-[5px] bg-white px-3 py-2 text-sm transition-shadow duration-150 placeholder:text-[rgba(55,53,47,0.35)] focus:outline-none ${icon !== undefined ? "pl-10" : ""} ${className}`}
          style={{
            border: borderStyle,
            color: "rgba(55, 53, 47, 1)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = `1px solid ${focusBorderColor}`;
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(35, 131, 226, 0.1)`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = borderStyle;
            e.currentTarget.style.boxShadow = "none";
          }}
          {...props}
        />
      </div>
      {hasError && (
        <span className="text-xs" style={{ color: "#E03E3E" }}>
          {error}
        </span>
      )}
    </div>
  );
}
