import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "optimized" | "warning" | "error" | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  optimized: "bg-primary/15 text-primary-container border border-primary/30",
  warning: "bg-amber-500/15 text-amber-200 border border-amber-500/30",
  error: "bg-error/15 text-error border border-error/30",
  neutral: "bg-surface-container text-fg-muted border border-border",
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
