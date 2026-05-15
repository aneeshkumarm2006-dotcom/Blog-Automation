"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Link as LinkIcon,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { SiteAnalysisCard } from "@/components/SiteAnalysisCard";
import { cn } from "@/lib/cn";
import { newBatchSchema } from "@/lib/schemas";
import type {
  ProjectDTO,
  SessionDTO,
  SessionStatus,
} from "@/types";

interface ProjectDetailProps {
  projectId: string;
  initialProject: ProjectDTO;
  initialBatches: SessionDTO[];
}

interface ZodIssueLike {
  path: ReadonlyArray<string | number>;
  message: string;
}

interface PairRow {
  id: string;
  keyword: string;
  backlink: string;
}

interface BatchFormErrors {
  name?: string;
  rows: Record<string, { keyword?: string; backlink?: string }>;
  keywordPairs?: string;
  blogCount?: string;
  wordCount?: string;
  form?: string;
}

const EMPTY_BATCH_ERRORS: BatchFormErrors = { rows: {} };

const BATCH_STATUS_META: Record<
  SessionStatus,
  { label: string; variant: "optimized" | "warning" | "error" | "neutral" }
> = {
  ideas_pending: { label: "Ideas Pending", variant: "warning" },
  ideas_approved: { label: "Approved", variant: "warning" },
  generating: { label: "Generating", variant: "warning" },
  humanizing: { label: "Humanizing", variant: "warning" },
  done: { label: "Done", variant: "optimized" },
  failed: { label: "Failed", variant: "error" },
};

function openHrefFor(batch: SessionDTO): string {
  switch (batch.status) {
    case "ideas_pending":
      return `/session/${batch._id}/ideas`;
    case "ideas_approved":
    case "generating":
    case "humanizing":
      return `/session/${batch._id}/generating`;
    case "done":
      return `/session/${batch._id}/export`;
    case "failed":
      return `/session/${batch._id}/ideas`;
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
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

function newRow(): PairRow {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    keyword: "",
    backlink: "",
  };
}

function defaultBatchName(): string {
  const d = new Date();
  const formatted = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `Batch — ${formatted}`;
}

export function ProjectDetail({
  projectId,
  initialProject,
  initialBatches,
}: ProjectDetailProps) {
  const router = useRouter();
  const [project, setProject] = React.useState<ProjectDTO>(initialProject);
  const [batches, setBatches] = React.useState<SessionDTO[]>(initialBatches);
  const [showNewBatch, setShowNewBatch] = React.useState(false);
  const [analysisError, setAnalysisError] = React.useState<
    string | undefined
  >();
  const [refreshing, setRefreshing] = React.useState(false);

  // Poll the project while analysis is running (e.g. after Refresh).
  React.useEffect(() => {
    if (project.analysisStatus !== "analyzing") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { project?: ProjectDTO };
        if (cancelled || !body.project) return;
        setProject(body.project);
      } catch {
        // ignore transient errors
      }
    };
    const handle = window.setInterval(tick, 5000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [project.analysisStatus, projectId]);

  const handleRefreshAnalysis = React.useCallback(async () => {
    setAnalysisError(undefined);
    setRefreshing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        project?: ProjectDTO;
      };
      if (!res.ok) {
        setAnalysisError(
          body.error ?? `Refresh failed (${res.status})`,
        );
        return;
      }
      if (body.project) setProject(body.project);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Network error",
      );
    } finally {
      setRefreshing(false);
    }
  }, [projectId]);

  const handleBatchCreated = React.useCallback(
    (batch: SessionDTO) => {
      setBatches((prev) => [batch, ...prev]);
      setShowNewBatch(false);
      router.replace(`/session/${batch._id}/ideas`);
      router.refresh();
    },
    [router],
  );

  const handleBatchRenamed = React.useCallback((batch: SessionDTO) => {
    setBatches((prev) => prev.map((b) => (b._id === batch._id ? batch : b)));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/projects"
          className="mb-3 inline-flex items-center gap-2 text-xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden />
          Back to projects
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-fg-muted">
              Project
            </p>
            <h1 className="font-serif text-3xl font-semibold text-fg">
              {project.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <LinkIcon size={14} aria-hidden />
                <a
                  href={project.websiteUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:underline"
                >
                  {hostnameOf(project.websiteUrl)}
                </a>
              </span>
              <span aria-hidden className="text-fg-muted/50">
                •
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden />
                Created {formatDateTime(project.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <SiteAnalysisCard
        project={project}
        onRefresh={handleRefreshAnalysis}
        refreshing={refreshing}
        error={analysisError}
      />

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold text-fg">
              Batches
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Each batch is one generation run. Keyword pairs + word counts are
              set per batch; the project&apos;s site analysis is reused.
            </p>
          </div>
          {!showNewBatch ? (
            <Button
              size="sm"
              onClick={() => setShowNewBatch(true)}
              disabled={project.analysisStatus !== "complete"}
              title={
                project.analysisStatus !== "complete"
                  ? "Finish site analysis first"
                  : undefined
              }
            >
              <Plus size={16} aria-hidden />
              New Batch
            </Button>
          ) : null}
        </div>

        {showNewBatch ? (
          <NewBatchForm
            projectId={projectId}
            onCancel={() => setShowNewBatch(false)}
            onCreated={handleBatchCreated}
          />
        ) : null}

        {batches.length === 0 ? (
          showNewBatch ? null : <BatchesEmptyState />
        ) : (
          <ul className="flex flex-col gap-2">
            {batches.map((batch) => (
              <BatchRow
                key={batch._id}
                batch={batch}
                onRenamed={handleBatchRenamed}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BatchesEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-fg-muted">
      No batches yet. Click <span className="text-fg">+ New Batch</span> to
      start one.
    </div>
  );
}

interface BatchRowProps {
  batch: SessionDTO;
  onRenamed: (batch: SessionDTO) => void;
}

function BatchRow({ batch, onRenamed }: BatchRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(batch.name);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSave = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === batch.name) {
      setEditing(false);
      setName(batch.name);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/batches/${batch._id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        batch?: SessionDTO;
        error?: string;
      };
      if (!res.ok || !body.batch) {
        setError(body.error ?? `Failed to rename (${res.status})`);
        return;
      }
      onRenamed(body.batch);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }, [batch._id, batch.name, name, onRenamed]);

  const meta = BATCH_STATUS_META[batch.status];
  const href = openHrefFor(batch);

  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-surface transition-colors",
        "hover:border-primary-container/60",
      )}
    >
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-grow">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSave();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(false);
                    setName(batch.name);
                    setError(undefined);
                  }
                }}
                disabled={saving}
                aria-label="Batch name"
                className="h-8 max-w-md"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleSave()}
                disabled={saving}
                aria-label="Save name"
              >
                {saving ? (
                  <LoaderCircle size={14} aria-hidden className="animate-spin" />
                ) : (
                  <Check size={14} aria-hidden />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setName(batch.name);
                  setError(undefined);
                }}
                disabled={saving}
                aria-label="Cancel rename"
              >
                <X size={14} aria-hidden />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href={href}
                className="min-w-0 truncate font-serif text-base font-medium text-fg hover:underline"
              >
                {batch.name}
              </Link>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Rename batch"
                title="Rename batch"
                className="grid h-7 w-7 place-items-center rounded text-fg-muted opacity-0 transition-opacity hover:bg-surface-container hover:text-fg group-hover:opacity-100"
              >
                <Pencil size={14} aria-hidden />
              </button>
            </div>
          )}
          {error ? (
            <p className="mt-1 text-xs text-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} aria-hidden />
              {formatDateTime(batch.createdAt)}
            </span>
            <span aria-hidden>•</span>
            <span>
              {batch.blogCount} blog{batch.blogCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden>•</span>
            <span>{batch.wordCount.toLocaleString()} words each</span>
          </div>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
        <Link
          href={href}
          aria-label="Open batch"
          title="Open"
          className="grid h-8 w-8 place-items-center rounded text-fg-muted hover:bg-surface-container hover:text-fg"
        >
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    </li>
  );
}

interface NewBatchFormProps {
  projectId: string;
  onCancel: () => void;
  onCreated: (batch: SessionDTO) => void;
}

function NewBatchForm({
  projectId,
  onCancel,
  onCreated,
}: NewBatchFormProps) {
  const [name, setName] = React.useState(defaultBatchName());
  const [rows, setRows] = React.useState<PairRow[]>(() => [newRow()]);
  const [blogCount, setBlogCount] = React.useState<number | "">(1);
  const [wordCount, setWordCount] = React.useState<number | "">(1500);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<BatchFormErrors>(
    EMPTY_BATCH_ERRORS,
  );

  function addRow() {
    setRows((current) => [...current, newRow()]);
  }

  function removeRow(id: string) {
    setRows((current) => {
      if (current.length <= 1) return current;
      return current.filter((r) => r.id !== id);
    });
  }

  function updateRow(id: string, patch: Partial<Omit<PairRow, "id">>) {
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function applyZodIssues(issues: ReadonlyArray<ZodIssueLike>) {
    const next: BatchFormErrors = { rows: {} };
    for (const issue of issues) {
      const [first, second, third] = issue.path;
      if (first === undefined) {
        next.form = next.form ?? issue.message;
        continue;
      }
      if (first === "name") {
        next.name = next.name ?? issue.message;
      } else if (first === "blogCount") {
        next.blogCount = next.blogCount ?? issue.message;
      } else if (first === "wordCount") {
        next.wordCount = next.wordCount ?? issue.message;
      } else if (first === "keywordPairs") {
        if (typeof second !== "number") {
          next.keywordPairs = next.keywordPairs ?? issue.message;
          continue;
        }
        const row = rows[second];
        if (!row) continue;
        const existing = next.rows[row.id] ?? {};
        if (third === "keyword") {
          existing.keyword = existing.keyword ?? issue.message;
        } else if (third === "backlink") {
          existing.backlink = existing.backlink ?? issue.message;
        } else {
          existing.keyword = existing.keyword ?? issue.message;
        }
        next.rows[row.id] = existing;
      }
    }
    setErrors(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setErrors(EMPTY_BATCH_ERRORS);

    const payload = {
      name: name.trim(),
      keywordPairs: rows.map(({ keyword, backlink }) => ({
        keyword: keyword.trim(),
        backlink: backlink.trim(),
      })),
      blogCount,
      wordCount,
    };

    const parsed = newBatchSchema.safeParse(payload);
    if (!parsed.success) {
      applyZodIssues(parsed.error.issues as ReadonlyArray<ZodIssueLike>);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        batch?: SessionDTO;
        error?: string;
        issues?: ReadonlyArray<ZodIssueLike>;
      };

      if (!res.ok || !data.batch) {
        if (data.issues) {
          applyZodIssues(data.issues);
        } else {
          setErrors({
            rows: {},
            form: data.error ?? "Failed to create batch. Try again.",
          });
        }
        setSubmitting(false);
        return;
      }

      onCreated(data.batch);
    } catch (err) {
      setErrors({
        rows: {},
        form: err instanceof Error ? err.message : "Network error",
      });
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mb-6 space-y-4 rounded-lg border border-border bg-surface p-5"
    >
      {errors.form ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded border border-error/30 bg-error/15 px-3 py-2 text-sm text-error"
        >
          {errors.form}
        </div>
      ) : null}

      <div>
        <label
          htmlFor="batch-name"
          className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-muted"
        >
          Batch name
        </label>
        <Input
          id="batch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          aria-invalid={errors.name ? true : undefined}
        />
        {errors.name ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {errors.name}
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Keyword &amp; Backlink Pairs</CardTitle>
          <CardDescription>
            Every keyword is included in each generated blog, hyperlinked to its
            backlink URL. Set the number of blogs separately below. Up to 20
            pairs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.keywordPairs ? (
            <p role="alert" className="text-xs text-error">
              {errors.keywordPairs}
            </p>
          ) : null}

          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 px-1 pb-1 text-xs font-medium uppercase tracking-wider text-fg-muted">
            <span>Keyword</span>
            <span>Backlink URL</span>
            <span className="sr-only">Remove</span>
          </div>

          <ul className="space-y-3">
            {rows.map((row, idx) => {
              const rowErr = errors.rows[row.id];
              return (
                <li
                  key={row.id}
                  className="grid grid-cols-[1fr_1fr_auto] items-start gap-3"
                >
                  <div>
                    <Input
                      aria-label={`Keyword ${idx + 1}`}
                      placeholder="best running shoes"
                      value={row.keyword}
                      onChange={(e) =>
                        updateRow(row.id, { keyword: e.target.value })
                      }
                      disabled={submitting}
                      aria-invalid={rowErr?.keyword ? true : undefined}
                    />
                    {rowErr?.keyword ? (
                      <p role="alert" className="mt-1 text-xs text-error">
                        {rowErr.keyword}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Input
                      aria-label={`Backlink ${idx + 1}`}
                      type="url"
                      inputMode="url"
                      placeholder="https://yoursite.com/landing"
                      value={row.backlink}
                      onChange={(e) =>
                        updateRow(row.id, { backlink: e.target.value })
                      }
                      disabled={submitting}
                      aria-invalid={rowErr?.backlink ? true : undefined}
                    />
                    {rowErr?.backlink ? (
                      <p role="alert" className="mt-1 text-xs text-error">
                        {rowErr.backlink}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove row ${idx + 1}`}
                    onClick={() => removeRow(row.id)}
                    disabled={submitting || rows.length <= 1}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded border border-border text-fg-muted",
                      "transition-colors hover:border-error/40 hover:bg-error/10 hover:text-error",
                      "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-fg-muted",
                    )}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>

          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addRow}
              disabled={submitting || rows.length >= 20}
            >
              <Plus size={14} aria-hidden /> Add row
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="blogCount"
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-muted"
          >
            Number of blogs
          </label>
          <Input
            id="blogCount"
            type="number"
            min={1}
            max={50}
            step={1}
            value={blogCount}
            onChange={(e) => {
              const raw = e.target.valueAsNumber;
              setBlogCount(Number.isNaN(raw) ? "" : raw);
            }}
            disabled={submitting}
            aria-invalid={errors.blogCount ? true : undefined}
          />
          {errors.blogCount ? (
            <p role="alert" className="mt-1 text-xs text-error">
              {errors.blogCount}
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="wordCount"
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-muted"
          >
            Word count per blog
          </label>
          <Input
            id="wordCount"
            type="number"
            min={500}
            max={4000}
            step={250}
            value={wordCount}
            onChange={(e) => {
              const raw = e.target.valueAsNumber;
              setWordCount(Number.isNaN(raw) ? "" : raw);
            }}
            disabled={submitting}
            aria-invalid={errors.wordCount ? true : undefined}
          />
          {errors.wordCount ? (
            <p role="alert" className="mt-1 text-xs text-error">
              {errors.wordCount}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? (
            <LoaderCircle size={14} aria-hidden className="animate-spin" />
          ) : (
            <Wand2 size={14} aria-hidden />
          )}
          {submitting ? "Creating batch..." : "Create batch & Generate ideas"}
        </Button>
      </div>
    </form>
  );
}
