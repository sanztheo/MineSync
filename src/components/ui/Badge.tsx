import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-surface-600 text-zinc-300 border-border-default",
  success: "bg-emerald-900/30 text-emerald-400 border-emerald-800/50",
  warning: "bg-amber-900/30 text-amber-400 border-amber-800/50",
  danger: "bg-red-900/30 text-red-400 border-red-800/50",
  info: "bg-blue-900/30 text-blue-400 border-blue-800/50",
};

export function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps): ReactNode {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
