import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  children: ReactNode;
}

export function Card({
  hoverable = false,
  className = "",
  children,
  ...props
}: CardProps): ReactNode {
  return (
    <div
      className={`rounded-lg bg-[var(--color-notion-bg)] p-4 ${hoverable ? "cursor-pointer hover:bg-[var(--color-notion-bg-hover)]" : ""} ${className}`}
      style={{
        border: "1px solid var(--color-notion-border-light)",
      }}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({
  className = "",
  children,
  ...props
}: CardSectionProps): ReactNode {
  return (
    <div className={`mb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: CardSectionProps): ReactNode {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: CardSectionProps): ReactNode {
  return (
    <div
      className={`mt-3 flex items-center gap-2 pt-3 ${className}`}
      style={{ borderTop: "1px solid var(--color-notion-border-light)" }}
      {...props}
    >
      {children}
    </div>
  );
}
