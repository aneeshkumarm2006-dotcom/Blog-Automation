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
  Link as LinkIcon,
  NotebookPen,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { slugifyBlog } from "@/lib/slugify";
import type { BlogDTO, IdeaDTO, SessionDTO } from "@/types";

interface ExportListProps {
  sessionId: string;
  session: SessionDTO;
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function previewOf(text: string): string {
  // Strip yaml frontmatter and keep the first ~700 characters of body for a
  // monospace preview block — enough to show the lede without dominating the
  // card.
  const stripped = text.replace(/^---[\s\S]*?---\n?/, "").trim();
  return stripped.length > 700 ? stripped.slice(0, 700).trimEnd() + "…" : stripped;
}

export function ExportList({
  sessionId,
  session,
  blogs,
  ideas,
}: ExportListProps) {
  const blogByIdea = React.useMemo(() => {
    const map = new Map<string, BlogDTO>();
    for (const b of blogs) map.set(b.ideaId, b);
    return map;
  }, [blogs]);

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
  const [copiedBlog, setCopiedBlog] = React.useState<string | undefined>();
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | undefined>();

  const setVariantFor = React.useCallback(
    (blogId: string, variant: Variant) => {
      setVariants((prev) => ({ ...prev, [blogId]: variant }));
    },
    [],
  );

  const toggleExpanded = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          setCopiedBlog((current) => (current === blog._id ? undefined : current));
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
        return `# ${idea.title}\n\n${content ?? ""}`.trim();
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
          href="/history"
          className="mb-3 inline-flex items-center gap-2 text-xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden />
          Back to history
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-fg">
              Export Blogs
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden />
                {formatDate(session.createdAt)}
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
                  href={session.websiteUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:underline"
                >
                  {hostnameOf(session.websiteUrl)}
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
        <EmptyState />
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
              onToggleExpanded={toggleExpanded}
              copied={!!row.blog && copiedBlog === row.blog._id}
              onCopy={copyOne}
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
  onToggleExpanded: (id: string) => void;
  copied: boolean;
  onCopy: (blog: BlogDTO) => void;
}

function BlogRow({
  sessionId,
  idea,
  blog,
  variant,
  onChangeVariant,
  expanded,
  onToggleExpanded,
  copied,
  onCopy,
}: BlogRowProps) {
  const slug = slugifyBlog(idea.title, idea._id);
  const isFailed = !blog || blog.status === "failed" ||
    (!blog.rawContent && !blog.humanizedContent);

  if (isFailed) {
    return (
      <li className="flex items-start gap-4 rounded-lg border border-border bg-surface p-5 opacity-70">
        <div className="min-w-0 flex-grow">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-base font-medium text-fg-muted">
              {idea.title}
            </h3>
            <Badge variant="error">Failed — re-run generation</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <Tag size={14} aria-hidden />
              {idea.assignedKeyword}
            </span>
            <span aria-hidden>•</span>
            <span>{idea.wordCountTarget.toLocaleString()} words target</span>
          </div>
        </div>
      </li>
    );
  }

  const content = variantContent(blog, variant);
  const downloadHref = `/api/sessions/${sessionId}/blogs/${blog._id}/download?variant=${variant}`;
  const humanizedAvailable = !!blog.humanizedContent && !blog.humanizationFailed;

  return (
    <li className="rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-serif text-base font-medium text-fg">
            {idea.title}
          </h3>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onCopy(blog)}
              aria-label={`Copy ${slug}.md to clipboard`}
              title="Copy to clipboard"
              className="grid h-8 w-8 place-items-center rounded text-fg-muted hover:bg-surface-container hover:text-fg"
            >
              {copied ? (
                <Check size={16} aria-hidden className="text-primary-container" />
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

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral" className="text-fg-muted">
            <Tag size={12} aria-hidden />
            {idea.assignedKeyword}
          </Badge>
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
            onClick={() => onToggleExpanded(blog._id)}
            className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
            aria-expanded={expanded}
            aria-controls={`preview-${blog._id}`}
          >
            {expanded ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )}
            {expanded ? "Hide Preview" : "Preview"}
          </button>
        </div>
      </div>

      {expanded && content ? (
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

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-surface px-8 py-12 text-center">
      <h2 className="font-serif text-lg font-medium text-fg">
        No blogs to export
      </h2>
      <p className="mt-2 text-sm text-fg-muted">
        This session finished without any generated blogs. Start a new session
        to try again.
      </p>
      <Link
        href="/session/new"
        className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-container"
      >
        Start a new session
      </Link>
    </div>
  );
}
