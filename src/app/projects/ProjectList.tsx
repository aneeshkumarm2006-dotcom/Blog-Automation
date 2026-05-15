"use client";

import * as React from "react";
import Link from "next/link";
import { Filter, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import type { ProjectAnalysisStatus, ProjectDTO } from "@/types";

interface ProjectListProps {
  projects: ProjectDTO[];
}

interface StatusMeta {
  label: string;
  variant: "optimized" | "warning" | "error" | "neutral";
}

const STATUS_META: Record<ProjectAnalysisStatus, StatusMeta> = {
  pending: { label: "Pending", variant: "neutral" },
  analyzing: { label: "Analyzing", variant: "warning" },
  complete: { label: "Ready", variant: "optimized" },
  failed: { label: "Failed", variant: "error" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
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

function openHrefFor(project: ProjectDTO): string {
  if (
    project.analysisStatus === "pending" ||
    project.analysisStatus === "analyzing"
  ) {
    return `/projects/${project._id}/analyzing`;
  }
  return `/projects/${project._id}`;
}

export function ProjectList({ projects }: ProjectListProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.websiteUrl.toLowerCase().includes(q),
    );
  }, [projects, query]);

  return (
    <div className="flex flex-col">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-fg-muted">
            Projects
          </p>
          <h1 className="font-serif text-3xl font-semibold text-fg">
            Your Projects
          </h1>
          <p className="mt-2 max-w-prose text-sm text-fg-muted">
            One project per website. Site analysis is stored once and reused
            across every batch of blogs you generate.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-container"
        >
          <Plus size={16} aria-hidden />
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
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
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="Filter by name or URL..."
                className="pl-9"
                aria-label="Filter projects"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-fg-muted">
              No projects match your filter.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((project) => (
                <ProjectCard key={project._id} project={project} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectDTO }) {
  const meta = STATUS_META[project.analysisStatus];
  const href = openHrefFor(project);
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "block rounded-lg border border-border bg-surface p-5 transition-colors",
          "hover:border-primary-container/60",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 truncate font-serif text-base font-semibold text-fg">
            {project.name}
          </h2>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <p
          className="mt-1 truncate text-xs text-fg-muted"
          title={project.websiteUrl}
        >
          {hostnameOf(project.websiteUrl)}
        </p>
        <p className="mt-3 text-xs text-fg-muted">
          Created {formatDate(project.createdAt)}
          {project.analyzedAt
            ? ` · Analyzed ${formatDate(project.analyzedAt)}`
            : null}
        </p>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-surface px-8 py-16 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary-container">
        <Sparkles size={20} aria-hidden />
      </div>
      <h2 className="font-serif text-lg font-medium text-fg">
        No projects yet
      </h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-fg-muted">
        Create your first project. Point Blog Automation at a website, and we&apos;ll
        analyze the niche, audience, and content gaps just once — then reuse
        that analysis across every batch of blogs you generate.
      </p>
      <Link
        href="/projects/new"
        className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-container"
      >
        <Plus size={16} aria-hidden />
        Create a project
      </Link>
    </div>
  );
}
