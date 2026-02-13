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
    background: "rgba(55, 53, 47, 0.08)",
    color: "rgba(55, 53, 47, 0.65)",
  },
  success: { background: "rgba(221, 237, 234, 1)", color: "#0F7B6C" },
  warning: { background: "rgba(251, 243, 219, 1)", color: "#DFAB01" },
  danger: { background: "rgba(251, 236, 221, 1)", color: "#E03E3E" },
  info: { background: "rgba(35, 131, 226, 0.1)", color: "#2383E2" },
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
