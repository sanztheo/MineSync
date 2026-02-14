import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<
  BadgeVariant,
  { background: string; color: string }
> = {
  default: {
    background: "var(--color-notion-bg-hover)",
    color: "var(--color-notion-text-secondary)",
  },
  success: {
    background: "var(--color-accent-green-bg)",
    color: "var(--color-accent-green)",
  },
  warning: {
    background: "var(--color-accent-yellow-bg)",
    color: "var(--color-accent-yellow)",
  },
  danger: {
    background: "var(--color-accent-red-bg)",
    color: "var(--color-accent-red)",
  },
  info: {
    background: "var(--color-accent-blue-bg)",
    color: "var(--color-accent-blue)",
  },
};

export function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps): ReactNode {
  const style = VARIANT_STYLES[variant];

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${className}`}
      style={{ background: style.background, color: style.color }}
    >
      {children}
    </span>
  );
}
