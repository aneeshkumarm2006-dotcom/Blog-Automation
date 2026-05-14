"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  Eye,
  Filter,
  Plus,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { SessionDTO, SessionStatus } from "@/types";

interface HistoryViewProps {
  sessions: SessionDTO[];
}

interface StatusMeta {
  label: string;
  variant: "optimized" | "warning" | "error" | "neutral";
  filterGroup: "done" | "in_progress" | "draft" | "failed";
}

const STATUS_META: Record<SessionStatus, StatusMeta> = {
  created: { label: "Draft", variant: "neutral", filterGroup: "draft" },
  analyzing: {
    label: "Analyzing",
    variant: "warning",
    filterGroup: "in_progress",
  },
  ideas_pending: {
    label: "Ideas Pending",
    variant: "warning",
    filterGroup: "in_progress",
  },
  ideas_approved: {
    label: "Approved",
    variant: "warning",
    filterGroup: "in_progress",
  },
  generating: {
    label: "Generating",
    variant: "warning",
    filterGroup: "in_progress",
  },
  humanizing: {
    label: "Humanizing",
    variant: "warning",
    filterGroup: "in_progress",
  },
  done: { label: "Done", variant: "optimized", filterGroup: "done" },
  failed: { label: "Failed", variant: "error", filterGroup: "failed" },
};

function openHrefFor(session: SessionDTO): string {
  const id = session._id;
  switch (session.status) {
    case "created":
    case "analyzing":
    case "failed":
      return `/session/${id}/analyzing`;
    case "ideas_pending":
      return `/session/${id}/ideas`;
    case "ideas_approved":
    case "generating":
    case "humanizing":
      return `/session/${id}/generating`;
    case "done":
      return `/session/${id}/export`;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function hostnameOf(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const trimmedPath = pathname.replace(/\/$/, "");
    return trimmedPath ? `${hostname}${trimmedPath}` : hostname;
  } catch {
    return url;
  }
}

type StatusFilter = "all" | "done" | "in_progress" | "draft" | "failed";

const PAGE_SIZE = 50;

export function HistoryView({ sessions }: HistoryViewProps) {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [page, setPage] = React.useState(0);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (statusFilter !== "all") {
        if (STATUS_META[s.status].filterGroup !== statusFilter) return false;
      }
      if (!q) return true;
      if (s.websiteUrl.toLowerCase().includes(q)) return true;
      return s.keywordPairs.some((kp) =>
        kp.keyword.toLowerCase().includes(q),
      );
    });
  }, [sessions, query, statusFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, total);
  const pageRows = filtered.slice(pageStart, pageEnd);
  const showingFrom = total === 0 ? 0 : pageStart + 1;

  return (
    <div className="flex flex-col">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-fg-muted">
            History
          </p>
          <h1 className="font-serif text-3xl font-semibold text-fg">
            Past Sessions
          </h1>
        </div>
        <Link
          href="/session/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-container"
        >
          <Plus size={16} aria-hidden />
          New Session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-container p-4">
            <div className="relative min-w-[200px] flex-1">
              <Filter
                size={16}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
              />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.currentTarget.value);
                  setPage(0);
                }}
                placeholder="Filter by URL or keyword..."
                className="pl-9"
                aria-label="Filter sessions"
              />
            </div>
            <div className="relative w-48">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.currentTarget.value as StatusFilter);
                  setPage(0);
                }}
                aria-label="Filter by status"
                className={cn(
                  "h-10 w-full cursor-pointer appearance-none rounded border border-border bg-surface px-4 pr-9 text-sm text-fg",
                  "focus:border-primary focus:outline-none",
                )}
              >
                <option value="all">All Statuses</option>
                <option value="done">Done</option>
                <option value="in_progress">In Progress</option>
                <option value="draft">Draft</option>
                <option value="failed">Failed</option>
              </select>
              <ChevronDown
                size={16}
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface-container">
                  <Th>Date</Th>
                  <Th>Website URL</Th>
                  <Th className="text-right">Blogs</Th>
                  <Th className="text-right">Words</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-fg-muted"
                    >
                      No sessions match your filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((session) => (
                    <Row key={session._id} session={session} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2">
            <p className="text-sm text-fg-muted">
              {total === 0
                ? "No sessions"
                : `Showing ${showingFrom}–${pageEnd} of ${total}`}
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs text-fg-muted">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-xs font-medium uppercase tracking-wider text-fg-muted",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Row({ session }: { session: SessionDTO }) {
  const meta = STATUS_META[session.status];
  const openHref = openHrefFor(session);
  const isDone = session.status === "done";

  return (
    <tr className="border-b border-border last:border-b-0 transition-colors hover:bg-surface-container">
      <td className="whitespace-nowrap px-4 py-4 text-sm text-fg">
        {formatDate(session.createdAt)}
      </td>
      <td className="px-4 py-4 text-sm text-fg">
        <span className="block max-w-[280px] truncate" title={session.websiteUrl}>
          {hostnameOf(session.websiteUrl)}
        </span>
      </td>
      <td className="px-4 py-4 text-right text-sm text-fg-muted">
        {session.blogCount}
      </td>
      <td className="px-4 py-4 text-right text-sm text-fg-muted">
        {session.wordCount.toLocaleString()}
      </td>
      <td className="px-4 py-4">
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </td>
      <td className="px-4 py-4 text-right">
        <div className="inline-flex items-center gap-1">
          <Link
            href={openHref}
            aria-label="Open session"
            title="Open"
            className="grid h-8 w-8 place-items-center rounded text-fg-muted hover:bg-surface-container-high hover:text-fg"
          >
            <Eye size={16} aria-hidden />
          </Link>
          {isDone ? (
            <Link
              href={`/session/${session._id}/export`}
              aria-label="Export blogs"
              title="Export"
              className="grid h-8 w-8 place-items-center rounded text-fg-muted hover:bg-surface-container-high hover:text-fg"
            >
              <Download size={16} aria-hidden />
            </Link>
          ) : (
            <span
              aria-hidden
              title="Export available when the session is done"
              className="grid h-8 w-8 place-items-center rounded text-fg-muted/30"
            >
              <Download size={16} aria-hidden />
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-surface px-8 py-16 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary-container">
        <Sparkles size={20} aria-hidden />
      </div>
      <h2 className="font-serif text-lg font-medium text-fg">
        No sessions yet
      </h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-fg-muted">
        Kick off your first BlogForge run. Point it at a site, attach your
        keyword pairs, and we&apos;ll draft ideas for your approval.
      </p>
      <Link
        href="/session/new"
        className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-container"
      >
        <Plus size={16} aria-hidden />
        Start a new session
      </Link>
    </div>
  );
}
