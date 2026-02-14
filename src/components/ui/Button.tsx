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
  primary:
    "bg-[var(--color-btn-primary)] hover:bg-[var(--color-btn-primary-hover)] active:bg-[var(--color-btn-primary-active)] text-white",
  secondary:
    "bg-[var(--color-accent-blue-bg)] text-[var(--color-notion-text)] hover:bg-[var(--color-notion-bg-hover)]",
  ghost:
    "bg-transparent text-[var(--color-notion-text-secondary)] hover:bg-[var(--color-notion-bg-hover)]",
  danger:
    "bg-[var(--color-accent-red)] hover:opacity-90 active:opacity-80 text-white",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[13px] gap-1.5 rounded-[4px]",
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
      ? "border border-[var(--color-notion-border)] hover:border-[var(--color-notion-border-strong)]"
      : "";

  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-notion-bg)] disabled:opacity-60 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${borderClass} ${className}`}
      {...props}
    >
      {icon !== undefined && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
