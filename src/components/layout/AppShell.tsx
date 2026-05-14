import * as React from "react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/cn";

export interface AppShellProps {
  children: React.ReactNode;
  width?: "wide" | "narrow";
  footerSlot?: React.ReactNode;
  className?: string;
}

export function AppShell({
  children,
  width = "wide",
  footerSlot,
  className,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <Sidebar footerSlot={footerSlot} />
      <main
        className={cn(
          "min-h-screen md:pl-rail lg:pl-sidebar",
          className,
        )}
      >
        <div
          className={cn(
            "mx-auto px-6 py-8 md:px-10 md:py-10",
            width === "wide" ? "max-w-[1200px]" : "max-w-[800px]",
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
