"use client";

import * as React from "react";
import Link from "next/link";
import { FilePlus, FolderKanban, Sparkles, Menu, X } from "lucide-react";
import { SidebarItem } from "@/components/ui/SidebarItem";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/projects", label: "Projects", icon: <FolderKanban size={16} /> },
  { href: "/projects/new", label: "New Project", icon: <FilePlus size={16} /> },
];

export interface SidebarProps {
  footerSlot?: React.ReactNode;
}

export function Sidebar({ footerSlot }: SidebarProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Mobile menu button (visible under md) */}
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed left-3 top-3 z-50 grid h-10 w-10 place-items-center rounded border border-border bg-surface text-fg md:hidden"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Backdrop for mobile drawer */}
      {open ? (
        <div
          onClick={() => setOpen(false)}
          aria-hidden
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-surface",
          "w-sidebar md:w-rail lg:w-sidebar",
          "transition-transform duration-200 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-5 md:justify-center md:px-0 lg:justify-start lg:px-5">
          <span className="grid h-7 w-7 place-items-center rounded bg-primary text-on-primary">
            <Sparkles size={16} />
          </span>
          <span className="font-serif text-base font-semibold text-fg md:hidden lg:inline">
            Blog Automation
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 md:px-2 lg:px-3">
          {NAV.map((item) => (
            <div key={item.href} className="md:hidden lg:block">
              <SidebarItem
                href={item.href}
                label={item.label}
                icon={item.icon}
              />
            </div>
          ))}
          {/* Compact rail variant (md→lg) */}
          <div className="hidden md:block lg:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className="flex items-center justify-center rounded px-2 py-2 text-fg-muted hover:bg-surface-container hover:text-fg"
              >
                <span className="grid h-5 w-5 place-items-center">{item.icon}</span>
              </Link>
            ))}
          </div>
        </nav>

        {footerSlot ? (
          <div className="border-t border-border px-5 py-4 text-xs text-fg-muted md:hidden lg:block">
            {footerSlot}
          </div>
        ) : null}
      </aside>
    </>
  );
}
