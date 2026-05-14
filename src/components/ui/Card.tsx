import * as React from "react";
import { cn } from "@/lib/cn";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, DivProps>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border bg-surface text-fg",
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, DivProps>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "border-b border-border px-6 py-4",
          className,
        )}
        {...props}
      />
    );
  },
);

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...props }, ref) {
  return (
    <h2
      ref={ref}
      className={cn("font-serif text-lg font-semibold text-fg", className)}
      {...props}
    />
  );
});

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-fg-muted", className)}
      {...props}
    />
  );
});

export const CardContent = React.forwardRef<HTMLDivElement, DivProps>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("px-6 py-5", className)} {...props} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, DivProps>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "border-t border-border px-6 py-4",
          className,
        )}
        {...props}
      />
    );
  },
);
