"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface SidebarItemProps {
  href: string;
  icon?: React.ReactNode;
  label: string;
  exact?: boolean;
  className?: string;
}

export function SidebarItem({
  href,
  icon,
  label,
  exact = false,
  className,
}: SidebarItemProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
        active
          ? "bg-[#252525] text-fg"
          : "text-fg-muted hover:bg-surface-container hover:text-fg",
        className,
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary"
        />
      ) : null}
      {icon ? <span className="grid h-4 w-4 place-items-center">{icon}</span> : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}
