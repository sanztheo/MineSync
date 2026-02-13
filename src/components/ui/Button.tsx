import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-[#222222] hover:bg-[#333333] active:bg-[#1a1a1a] text-white",
  secondary:
    "bg-transparent text-[rgba(55,53,47,0.85)] hover:bg-[rgba(55,53,47,0.04)]",
  ghost:
    "bg-transparent text-[rgba(55,53,47,0.65)] hover:bg-[rgba(55,53,47,0.06)]",
  danger: "bg-[#E03E3E] hover:bg-[#cc3636] active:bg-[#b82e2e] text-white",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[13px] gap-1.5 rounded",
  md: "h-8 px-3 text-sm gap-2 rounded-[5px]",
  lg: "h-10 px-4 text-sm gap-2 rounded-[6px]",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps): ReactNode {
  const borderClass =
    variant === "secondary"
      ? "border border-[rgba(55,53,47,0.16)] hover:border-[rgba(55,53,47,0.32)]"
      : "";

  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(35,131,226,0.3)] focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${borderClass} ${className}`}
      {...props}
    >
      {icon !== undefined && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
