"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ProjectDTO, SiteAnalysis } from "@/types";

interface SiteAnalysisCardProps {
  project: ProjectDTO;
  onRefresh: () => void;
  refreshing: boolean;
  error?: string;
}

function formatRelative(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SiteAnalysisCard({
  project,
  onRefresh,
  refreshing,
  error,
}: SiteAnalysisCardProps) {
  const [open, setOpen] = React.useState(false);
  const analysis = project.siteAnalysis as SiteAnalysis | undefined;
  const status = project.analysisStatus;
  const lastAnalyzed = formatRelative(project.analyzedAt);

  const gaps = analysis?.content_gaps?.filter(Boolean) ?? [];
  const hooks = analysis?.differentiation_hooks?.filter(Boolean) ?? [];
  const niche = analysis?.niche;
  const audience = analysis?.audience?.primary;

  const summary = [
    niche ? `Niche: ${niche}` : null,
    audience ? `Audience: ${audience}` : null,
    gaps.length
      ? `${gaps.length} content gap${gaps.length === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-grow items-start gap-3 text-left"
          aria-expanded={open}
        >
          <span className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded border border-border bg-surface text-primary-container">
            {open ? (
              <ChevronDown size={16} aria-hidden />
            ) : (
              <ChevronRight size={16} aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-grow">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-base font-semibold text-fg">
                Site analysis
              </h2>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1 truncate text-sm text-fg-muted">
              {summary || (analysis ? "Site analysis complete." : "No analysis yet.")}
            </p>
            {lastAnalyzed ? (
              <p className="mt-0.5 text-xs text-fg-muted/80">
                Last analyzed: {lastAnalyzed}
              </p>
            ) : null}
          </div>
        </button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing || status === "analyzing"}
        >
          {refreshing || status === "analyzing" ? (
            <LoaderCircle size={14} aria-hidden className="animate-spin" />
          ) : (
            <RefreshCw size={14} aria-hidden />
          )}
          {status === "analyzing" ? "Analyzing…" : "Refresh website data"}
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded border border-error/30 bg-error/10 px-3 py-2 text-xs text-error"
        >
          <TriangleAlert size={14} aria-hidden className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {project.failureReason && status === "failed" ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded border border-error/30 bg-error/10 px-3 py-2 text-xs text-error"
        >
          <TriangleAlert size={14} aria-hidden className="mt-0.5 flex-shrink-0" />
          <span>{project.failureReason}</span>
        </div>
      ) : null}

      {open && analysis ? (
        <div className="mt-4 grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-2">
          {gaps.length > 0 ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-fg-muted">
                Content gaps
              </p>
              <ul className="list-disc space-y-1 pl-4 text-fg">
                {gaps.slice(0, 6).map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {hooks.length > 0 ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-fg-muted">
                Differentiation hooks
              </p>
              <ul className="list-disc space-y-1 pl-4 text-fg">
                {hooks.slice(0, 6).map((hook) => (
                  <li key={hook}>{hook}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function StatusBadge({ status }: { status: ProjectDTO["analysisStatus"] }) {
  switch (status) {
    case "complete":
      return <Badge variant="optimized">Ready</Badge>;
    case "analyzing":
      return <Badge variant="warning">Analyzing</Badge>;
    case "failed":
      return <Badge variant="error">Failed</Badge>;
    case "pending":
    default:
      return (
        <Badge variant="neutral" className={cn("text-fg-muted")}>
          Pending
        </Badge>
      );
  }
}
