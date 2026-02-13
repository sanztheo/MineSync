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
      className={`rounded-lg bg-white p-4 ${hoverable ? "cursor-pointer hover:bg-[rgba(55,53,47,0.02)]" : ""} ${className}`}
      style={{
        border: "1px solid rgba(55, 53, 47, 0.09)",
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
      style={{ borderTop: "1px solid rgba(55, 53, 47, 0.09)" }}
      {...props}
    >
      {children}
    </div>
  );
}
