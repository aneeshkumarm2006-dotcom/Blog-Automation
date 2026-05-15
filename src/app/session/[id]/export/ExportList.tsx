"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  Download,
  FileText,
  GitCompare,
  Link as LinkIcon,
  LoaderCircle,
  NotebookPen,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { diffDocuments, type DiffRow, type Segment } from "@/lib/diff";
import { slugifyBlog } from "@/lib/slugify";
import type { BlogDTO, IdeaDTO, ProjectDTO, SessionDTO } from "@/types";

type PreviewKind = "content" | "diff";

interface ExportListProps {
  sessionId: string;
  session: SessionDTO;
  project: ProjectDTO;
  blogs: BlogDTO[];
  ideas: IdeaDTO[];
}

type Variant = "humanized" | "raw";

interface Row {
  idea: IdeaDTO;
  blog: BlogDTO | undefined;
}

function pickInitialVariant(blog: BlogDTO | undefined): Variant {
  if (!blog) return "humanized";
  if (blog.humanizedContent && !blog.humanizationFailed) return "humanized";
  return "raw";
}

function variantContent(blog: BlogDTO, variant: Variant): string | undefined {
  if (variant === "humanized") {
    return blog.humanizedContent ?? blog.rawContent;
  }
  return blog.rawContent ?? blog.humanizedContent;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function previewOf(text: string): string {
  return text.replace(/^---[\s\S]*?---\n?/, "").trim();
}

function blogDisplayName(blog: BlogDTO | undefined, idea: IdeaDTO): string {
  return blog?.name?.trim() || idea.title;
}

// A diff is only meaningful when ZeroGPT actually produced a distinct
// humanized variant alongside the raw draft.
function diffAvailable(blog: BlogDTO): boolean {
  if (blog.humanizationFailed) return false;
  if (!blog.rawContent || !blog.humanizedContent) return false;
  return previewOf(blog.rawContent) !== previewOf(blog.humanizedContent);
}

export function ExportList({
  sessionId,
  session,
  project,
  blogs,
  ideas,
}: ExportListProps) {
  const [blogState, setBlogState] = React.useState<BlogDTO[]>(blogs);

  const blogByIdea = React.useMemo(() => {
    const map = new Map<string, BlogDTO>();
    for (const b of blogState) map.set(b.ideaId, b);
    return map;
  }, [blogState]);

  const rows: Row[] = React.useMemo(
    () => ideas.map((idea) => ({ idea, blog: blogByIdea.get(idea._id) })),
    [ideas, blogByIdea],
  );

  const exportable = React.useMemo(
    () =>
      rows.filter(
        (r): r is Row & { blog: BlogDTO } =>
          !!r.blog &&
          (!!r.blog.rawContent || !!r.blog.humanizedContent) &&
          r.blog.status !== "failed",
      ),
    [rows],
  );

  const [variants, setVariants] = React.useState<Record<string, Variant>>(
    () => {
      const init: Record<string, Variant> = {};
      for (const row of rows) {
        if (row.blog) init[row.blog._id] = pickInitialVariant(row.blog);
      }
      return init;
    },
  );
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [previewKind, setPreviewKind] = React.useState<
    Record<string, PreviewKind>
  >({});
  const [copiedBlog, setCopiedBlog] = React.useState<string | undefined>();
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | undefined>();

  const setVariantFor = React.useCallback(
    (blogId: string, variant: Variant) => {
      setVariants((prev) => ({ ...prev, [blogId]: variant }));
    },
    [],
  );

  // One handler drives both the "Preview" and "Diff" toggles. Re-clicking the
  // kind that's already open collapses the panel; clicking the other kind
  // switches the open panel without closing it.
  const togglePreview = React.useCallback(
    (id: string, kind: PreviewKind) => {
      const isOpen = expanded.has(id);
      const currentKind = previewKind[id] ?? "content";
      const closing = isOpen && currentKind === kind;
      setExpanded((prev) => {
        const next = new Set(prev);
        if (closing) next.delete(id);
        else next.add(id);
        return next;
      });
      if (!closing) {
        setPreviewKind((prev) => ({ ...prev, [id]: kind }));
      }
    },
    [expanded, previewKind],
  );

  const handleBlogRenamed = React.useCallback((blog: BlogDTO) => {
    setBlogState((prev) => prev.map((b) => (b._id === blog._id ? blog : b)));
  }, []);

  const writeClipboard = React.useCallback(async (text: string) => {
    if (!navigator?.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable in this browser");
    }
    await navigator.clipboard.writeText(text);
  }, []);

  const copyOne = React.useCallback(
    async (blog: BlogDTO) => {
      const variant = variants[blog._id] ?? pickInitialVariant(blog);
      const content = variantContent(blog, variant);
      if (!content) return;
      try {
        await writeClipboard(content);
        setCopyError(undefined);
        setCopiedBlog(blog._id);
        window.setTimeout(() => {
          setCopiedBlog((current) =>
            current === blog._id ? undefined : current,
          );
        }, 1800);
      } catch (err) {
        setCopyError(
          err instanceof Error ? err.message : "Failed to copy to clipboard",
        );
      }
    },
    [variants, writeClipboard],
  );

  const copyAll = React.useCallback(async () => {
    if (exportable.length === 0) return;
    const combined = exportable
      .map(({ idea, blog }) => {
        const variant = variants[blog._id] ?? pickInitialVariant(blog);
        const content = variantContent(blog, variant);
        const name = blogDisplayName(blog, idea);
        return `# ${name}\n\n${content ?? ""}`.trim();
      })
      .join("\n\n---\n\n");
    try {
      await writeClipboard(combined);
      setCopyError(undefined);
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1800);
    } catch (err) {
      setCopyError(
        err instanceof Error ? err.message : "Failed to copy to clipboard",
      );
    }
  }, [exportable, variants, writeClipboard]);

  const exportableCount = exportable.length;
  const total = rows.length;
  const failedCount = rows.filter((r) => r.blog?.status === "failed").length;

  return (
    <div className="flex flex-col">
      <header className="mb-8">
        <Link
          href={`/projects/${project._id}`}
          className="mb-3 inline-flex items-center gap-2 text-xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden />
          {project.name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-fg-muted">
              {session.name}
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-fg">
              Export Blogs
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden />
                {formatDateTime(session.createdAt)}
              </span>
              <span aria-hidden className="text-fg-muted/50">
                •
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText size={14} aria-hidden />
                {exportableCount} Generated
                {failedCount > 0 ? (
                  <span className="text-error/90">
                    {" "}
                    ({failedCount} failed)
                  </span>
                ) : null}
              </span>
              <span aria-hidden className="text-fg-muted/50">
                •
              </span>
              <span className="inline-flex items-center gap-1.5 text-fg">
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
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={copyAll}
              disabled={exportableCount === 0}
              aria-label="Copy all blogs to clipboard"
            >
              {copiedAll ? (
                <Check size={16} aria-hidden />
              ) : (
                <Copy size={16} aria-hidden />
              )}
              {copiedAll ? "Copied" : "Copy All"}
            </Button>
            <a
              href={
                exportableCount === 0
                  ? undefined
                  : `/api/sessions/${sessionId}/export/zip`
              }
              aria-disabled={exportableCount === 0}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded px-4 text-sm font-medium transition-colors",
                "bg-primary text-on-primary hover:bg-primary-container",
                exportableCount === 0 && "pointer-events-none opacity-50",
              )}
            >
              <Download size={16} aria-hidden />
              Download All (.zip)
            </a>
          </div>
        </div>
      </header>

      {copyError ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
        >
          <CircleAlert size={16} aria-hidden className="mt-0.5 flex-shrink-0" />
          <span>{copyError}</span>
        </div>
      ) : null}

      {total === 0 ? (
        <EmptyState project={project} />
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row) => (
            <BlogRow
              key={row.idea._id}
              sessionId={sessionId}
              idea={row.idea}
              blog={row.blog}
              variant={
                row.blog
                  ? (variants[row.blog._id] ?? pickInitialVariant(row.blog))
                  : "humanized"
              }
              onChangeVariant={setVariantFor}
              expanded={row.blog ? expanded.has(row.blog._id) : false}
              previewKind={
                row.blog ? (previewKind[row.blog._id] ?? "content") : "content"
              }
              onTogglePreview={togglePreview}
              copied={!!row.blog && copiedBlog === row.blog._id}
              onCopy={copyOne}
              onRenamed={handleBlogRenamed}
            />
          ))}
        </ol>
      )}
    </div>
  );
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

interface BlogRowProps {
  sessionId: string;
  idea: IdeaDTO;
  blog: BlogDTO | undefined;
  variant: Variant;
  onChangeVariant: (blogId: string, variant: Variant) => void;
  expanded: boolean;
  previewKind: PreviewKind;
  onTogglePreview: (id: string, kind: PreviewKind) => void;
  copied: boolean;
  onCopy: (blog: BlogDTO) => void;
  onRenamed: (blog: BlogDTO) => void;
}

function BlogRow({
  sessionId,
  idea,
  blog,
  variant,
  onChangeVariant,
  expanded,
  previewKind,
  onTogglePreview,
  copied,
  onCopy,
  onRenamed,
}: BlogRowProps) {
  const displayName = blogDisplayName(blog, idea);
  const slug = slugifyBlog(displayName, blog?._id ?? idea._id);
  const isFailed =
    !blog ||
    blog.status === "failed" ||
    (!blog.rawContent && !blog.humanizedContent);

  if (isFailed) {
    return (
      <li className="flex items-start gap-4 rounded-lg border border-border bg-surface p-5 opacity-70">
        <div className="min-w-0 flex-grow">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-base font-medium text-fg-muted">
              {displayName}
            </h3>
            <Badge variant="error">Failed — re-run generation</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
            <span>{idea.wordCountTarget.toLocaleString()} words target</span>
          </div>
        </div>
      </li>
    );
  }

  const content = variantContent(blog, variant);
  const downloadHref = `/api/sessions/${sessionId}/blogs/${blog._id}/download?variant=${variant}`;
  const humanizedAvailable = !!blog.humanizedContent && !blog.humanizationFailed;
  const canDiff = diffAvailable(blog);
  const showingDiff = expanded && previewKind === "diff";
  const showingContent = expanded && previewKind === "content";

  return (
    <li className="rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <BlogNameField
            blog={blog}
            fallback={idea.title}
            onRenamed={onRenamed}
          />
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onCopy(blog)}
              aria-label={`Copy ${slug}.md to clipboard`}
              title="Copy to clipboard"
              className="grid h-8 w-8 place-items-center rounded text-fg-muted hover:bg-surface-container hover:text-fg"
            >
              {copied ? (
                <Check
                  size={16}
                  aria-hidden
                  className="text-primary-container"
                />
              ) : (
                <Copy size={16} aria-hidden />
              )}
            </button>
            <a
              href={downloadHref}
              aria-label={`Download ${slug}.md`}
              title="Download .md"
              className="grid h-8 w-8 place-items-center rounded text-fg-muted hover:bg-surface-container hover:text-fg"
            >
              <Download size={16} aria-hidden />
            </a>
          </div>
        </div>

        {blog.generatedAt ? (
          <p className="-mt-1 text-xs text-fg-muted">
            Generated {formatDateTime(blog.generatedAt)}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {blog.wordCount ? (
            <Badge variant="neutral" className="text-fg-muted">
              <NotebookPen size={12} aria-hidden />
              {blog.wordCount.toLocaleString()} words
            </Badge>
          ) : null}
          <Badge variant="optimized">
            <Check size={12} aria-hidden />
            Humanized {humanizedAvailable ? "✓" : "✗"}
          </Badge>
          {blog.humanizationFailed ? (
            <Badge variant="warning">humanization skipped — raw only</Badge>
          ) : null}

          <div
            className="ml-auto inline-flex overflow-hidden rounded border border-border"
            role="group"
            aria-label="Content variant"
          >
            <button
              type="button"
              onClick={() => onChangeVariant(blog._id, "humanized")}
              disabled={!blog.humanizedContent}
              className={cn(
                "px-3 py-1 text-xs transition-colors",
                variant === "humanized"
                  ? "bg-primary text-on-primary"
                  : "bg-transparent text-fg-muted hover:text-fg",
                !blog.humanizedContent && "cursor-not-allowed opacity-40",
              )}
            >
              Humanized
            </button>
            <button
              type="button"
              onClick={() => onChangeVariant(blog._id, "raw")}
              disabled={!blog.rawContent}
              className={cn(
                "border-l border-border px-3 py-1 text-xs transition-colors",
                variant === "raw"
                  ? "bg-primary text-on-primary"
                  : "bg-transparent text-fg-muted hover:text-fg",
                !blog.rawContent && "cursor-not-allowed opacity-40",
              )}
            >
              Raw
            </button>
          </div>

          <button
            type="button"
            onClick={() => onTogglePreview(blog._id, "content")}
            className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
            aria-expanded={showingContent}
            aria-controls={`preview-${blog._id}`}
          >
            {showingContent ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )}
            {showingContent ? "Hide Preview" : "Preview"}
          </button>

          <button
            type="button"
            onClick={() => onTogglePreview(blog._id, "diff")}
            disabled={!canDiff}
            title={
              canDiff
                ? "Side-by-side raw vs humanized"
                : "No humanized changes to compare"
            }
            className={cn(
              "inline-flex items-center gap-1 text-xs",
              canDiff
                ? "text-fg-muted hover:text-fg"
                : "cursor-not-allowed text-fg-muted/40",
            )}
            aria-expanded={showingDiff}
            aria-controls={`preview-${blog._id}`}
          >
            <GitCompare size={14} aria-hidden />
            {showingDiff ? "Hide Diff" : "Diff"}
          </button>
        </div>
      </div>

      {expanded && previewKind === "diff" && canDiff ? (
        <div
          id={`preview-${blog._id}`}
          className="border-t border-border bg-surface-container px-5 py-4"
        >
          <DiffView
            raw={previewOf(blog.rawContent ?? "")}
            humanized={previewOf(blog.humanizedContent ?? "")}
          />
        </div>
      ) : expanded && previewKind === "content" && content ? (
        <div
          id={`preview-${blog._id}`}
          className="border-t border-border bg-surface-container px-5 py-4"
        >
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-fg-muted">
            {previewOf(content)}
          </pre>
        </div>
      ) : null}
    </li>
  );
}

interface DiffViewProps {
  raw: string;
  humanized: string;
}

function DiffView({ raw, humanized }: DiffViewProps) {
  const diff = React.useMemo(
    () => diffDocuments(raw, humanized),
    [raw, humanized],
  );

  if (diff.changedLines === 0 && diff.addedLines === 0 && diff.removedLines === 0) {
    return (
      <p className="text-xs text-fg-muted">
        Humanized output is identical to the raw draft.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span>
          <span className="font-medium text-fg">{diff.changedLines}</span>{" "}
          changed
        </span>
        <span>
          <span className="font-medium text-emerald-300">
            +{diff.addedLines}
          </span>{" "}
          added
        </span>
        <span>
          <span className="font-medium text-error">
            -{diff.removedLines}
          </span>{" "}
          removed
        </span>
        <span aria-hidden className="text-fg-muted/50">
          •
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-error/40" />
          raw
          <span className="ml-2 inline-block h-2 w-2 rounded-sm bg-emerald-500/40" />
          humanized
        </span>
      </div>
      <div className="max-h-96 overflow-auto rounded border border-border">
        <table className="w-full table-fixed border-collapse font-mono text-xs leading-relaxed">
          <colgroup>
            <col className="w-1/2" />
            <col className="w-1/2" />
          </colgroup>
          <tbody>
            {diff.rows.map((row, i) => (
              <DiffRowCells key={i} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function segmentClass(type: Segment["type"]): string {
  if (type === "removed") {
    return "rounded-sm bg-error/25 text-error";
  }
  if (type === "added") {
    return "rounded-sm bg-emerald-500/25 text-emerald-200";
  }
  return "";
}

function SegmentList({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        const cls = segmentClass(seg.type);
        return cls ? (
          <span key={i} className={cls}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        );
      })}
    </>
  );
}

function DiffRowCells({ row }: { row: DiffRow }) {
  const leftTone =
    row.type === "removed" || row.type === "changed"
      ? "bg-error/[0.06]"
      : "";
  const rightTone =
    row.type === "added" || row.type === "changed"
      ? "bg-emerald-500/[0.06]"
      : "";

  return (
    <tr className="align-top">
      <td
        className={cn(
          "whitespace-pre-wrap break-words border-r border-border px-3 py-0.5 text-fg-muted",
          leftTone,
        )}
      >
        {row.left ? <SegmentList segments={row.left} /> : " "}
      </td>
      <td
        className={cn(
          "whitespace-pre-wrap break-words px-3 py-0.5 text-fg-muted",
          rightTone,
        )}
      >
        {row.right ? <SegmentList segments={row.right} /> : " "}
      </td>
    </tr>
  );
}

interface BlogNameFieldProps {
  blog: BlogDTO;
  fallback: string;
  onRenamed: (blog: BlogDTO) => void;
}

function BlogNameField({ blog, fallback, onRenamed }: BlogNameFieldProps) {
  const initial = blog.name?.trim() || fallback;
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startEdit = React.useCallback(() => {
    setValue(initial);
    setEditing(true);
  }, [initial]);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const save = React.useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setEditing(false);
      setValue(initial);
      return;
    }
    if (trimmed === initial) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/blogs/${blog._id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        blog?: BlogDTO;
        error?: string;
      };
      if (!res.ok || !body.blog) {
        setError(body.error ?? `Failed to rename (${res.status})`);
        return;
      }
      onRenamed(body.blog);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }, [blog._id, initial, onRenamed, value]);

  if (editing) {
    return (
      <div className="flex min-w-0 flex-grow items-center gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
              setValue(initial);
              setError(undefined);
            }
          }}
          disabled={saving}
          aria-label="Blog name"
          className="h-8 max-w-xl"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void save()}
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
            setValue(initial);
            setError(undefined);
          }}
          disabled={saving}
          aria-label="Cancel"
        >
          <X size={14} aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-grow items-center gap-2">
      <h3 className="min-w-0 truncate font-serif text-base font-medium text-fg">
        {initial}
      </h3>
      <button
        type="button"
        onClick={startEdit}
        aria-label="Rename blog"
        title="Rename"
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded text-fg-muted hover:bg-surface-container hover:text-fg"
      >
        <Pencil size={14} aria-hidden />
      </button>
      {error ? (
        <span role="alert" className="text-xs text-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function EmptyState({ project }: { project: ProjectDTO }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-8 py-12 text-center">
      <h2 className="font-serif text-lg font-medium text-fg">
        No blogs to export
      </h2>
      <p className="mt-2 text-sm text-fg-muted">
        This batch finished without any generated blogs. Try a new batch from
        the project page.
      </p>
      <Link
        href={`/projects/${project._id}`}
        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-container"
      >
        Back to project
      </Link>
    </div>
  );
}
