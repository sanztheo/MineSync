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
  const hoverStyles = hoverable
    ? "transition-colors hover:border-border-hover hover:bg-surface-600 cursor-pointer"
    : "";

  return (
    <div
      className={`rounded-xl border border-border-default bg-surface-700 p-4 ${hoverStyles} ${className}`}
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
      className={`mt-4 flex items-center gap-2 border-t border-border-default pt-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
