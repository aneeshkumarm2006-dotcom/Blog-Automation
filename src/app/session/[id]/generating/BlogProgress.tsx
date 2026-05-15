"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  CircleCheckBig,
  CircleDashed,
  Info,
  LoaderCircle,
  NotebookPen,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/cn";
import { useGenerationCompleteNotification } from "@/lib/browserNotify";
import type {
  BlogDTO,
  BlogStatus,
  IdeaDTO,
  ProjectDTO,
  SessionDTO,
} from "@/types";

interface BlogProgressProps {
  sessionId: string;
  initialSession: SessionDTO;
  initialProject: ProjectDTO;
  initialBlogs: BlogDTO[];
  initialIdeas: IdeaDTO[];
}

const POLL_INTERVAL_MS = 5000;

type CardState =
  | { kind: "queued"; idea: IdeaDTO; blog?: BlogDTO }
  | { kind: "writing"; idea: IdeaDTO; blog: BlogDTO }
  | { kind: "humanizing"; idea: IdeaDTO; blog: BlogDTO }
  | { kind: "done"; idea: IdeaDTO; blog: BlogDTO }
  | { kind: "failed"; idea: IdeaDTO; blog: BlogDTO };

function stateFor(idea: IdeaDTO, blog: BlogDTO | undefined): CardState {
  if (!blog) return { kind: "queued", idea };
  switch (blog.status as BlogStatus) {
    case "writing":
      return { kind: "writing", idea, blog };
    case "humanizing":
      return { kind: "humanizing", idea, blog };
    case "raw":
    case "humanized":
      return { kind: "done", idea, blog };
    case "failed":
      return { kind: "failed", idea, blog };
    case "queued":
    default:
      return { kind: "queued", idea, blog };
  }
}

function isTerminal(state: CardState): boolean {
  return state.kind === "done" || state.kind === "failed";
}

export function BlogProgress({
  sessionId,
  initialSession,
  initialProject,
  initialBlogs,
  initialIdeas,
}: BlogProgressProps) {
  const router = useRouter();
  const [session, setSession] = React.useState<SessionDTO>(initialSession);
  const [blogs, setBlogs] = React.useState<BlogDTO[]>(initialBlogs);
  const [ideas] = React.useState<IdeaDTO[]>(initialIdeas);
  const [error, setError] = React.useState<string | undefined>();
  const kickedOff = React.useRef(false);

  // 1) Kick off the generate loop exactly once on mount, if needed.
  React.useEffect(() => {
    if (kickedOff.current) return;
    if (session.status !== "ideas_approved" && session.status !== "failed") {
      // Already running on the server, or already done — skip.
      return;
    }
    kickedOff.current = true;
    // Fire-and-forget. The server holds the request open through the whole
    // batch; we don't await the response (polling drives the UI). Any failure
    // surfaces via the session.failureReason field.
    fetch(`/api/sessions/${sessionId}/generate`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error ?? `Generation failed (${res.status})`);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Network error");
      });
  }, [session.status, sessionId]);

  // 2) Poll session + blogs every 3 seconds until session.status === "done".
  React.useEffect(() => {
    if (session.status === "done") return;

    let cancelled = false;
    const tick = async () => {
      try {
        const [sessionRes, blogsRes] = await Promise.all([
          fetch(`/api/sessions/${sessionId}`, { cache: "no-store" }),
          fetch(`/api/sessions/${sessionId}/blogs`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (sessionRes.ok) {
          const body = (await sessionRes.json()) as { session?: SessionDTO };
          if (body.session) setSession(body.session);
        }
        if (blogsRes.ok) {
          const body = (await blogsRes.json()) as { blogs?: BlogDTO[] };
          if (body.blogs) setBlogs(body.blogs);
        }
      } catch {
        // Transient errors are swallowed — the next tick retries.
      }
    };
    const handle = window.setInterval(tick, POLL_INTERVAL_MS);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [sessionId, session.status]);

  // 3) Redirect to /export when the session lands at "done".
  React.useEffect(() => {
    if (session.status === "done") {
      router.replace(`/session/${sessionId}/export`);
    }
  }, [router, sessionId, session.status]);

  const blogByIdea = React.useMemo(() => {
    const map = new Map<string, BlogDTO>();
    for (const b of blogs) map.set(b.ideaId, b);
    return map;
  }, [blogs]);

  const states: CardState[] = ideas.map((idea) =>
    stateFor(idea, blogByIdea.get(idea._id)),
  );

  const completeCount = states.filter((s) => s.kind === "done").length;
  const failedCount = states.filter((s) => s.kind === "failed").length;
  const total = states.length;
  const pct = total === 0 ? 0 : ((completeCount + failedCount) / total) * 100;
  const allDone = states.every(isTerminal);

  // Ping the OS notification center when the batch finishes — long runs
  // (10+ blogs × ~60s) tempt the user to tab away. No-ops while the tab is
  // focused or permission is denied.
  useGenerationCompleteNotification({
    status: session.status,
    isRunning: session.status !== "done",
    sessionName: initialSession.name,
    completed: completeCount,
    total,
    url: `/session/${sessionId}/export`,
  });

  return (
    <div className="flex flex-col">
      <header className="mb-8">
        <Link
          href={`/projects/${initialProject._id}`}
          className="mb-3 inline-flex items-center gap-2 text-xs text-fg-muted hover:text-fg"
        >
          ← {initialProject.name}
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-fg-muted">
              Step 3 of 3 · {initialSession.name}
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-fg">
              Generating Blogs
            </h1>
            <p className="mt-2 text-sm text-fg-muted">
              Automated editorial batch in progress.
            </p>
          </div>
          <div className="text-right">
            <span className="block text-xs font-medium uppercase tracking-wider text-primary-container">
              {completeCount + failedCount} of {total} complete
            </span>
          </div>
        </div>
        <div className="mt-4">
          <Progress
            value={pct}
            label={`${completeCount + failedCount} of ${total} blogs complete`}
          />
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
        >
          <TriangleAlert
            size={16}
            aria-hidden
            className="mt-0.5 flex-shrink-0"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {session.failureReason && !allDone ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
        >
          <TriangleAlert
            size={16}
            aria-hidden
            className="mt-0.5 flex-shrink-0"
          />
          <span>{session.failureReason}</span>
        </div>
      ) : null}

      <ol className="mb-8 flex flex-col gap-2">
        {states.map((state) => (
          <BlogCard key={state.idea._id} state={state} />
        ))}
      </ol>

      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-6">
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <Info size={16} aria-hidden />
          Note: Blogs generate one at a time to ensure optimal editorial
          quality.
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          {allDone ? (
            <>
              <CircleCheckBig
                size={14}
                aria-hidden
                className="text-primary-container"
              />
              Redirecting to export…
            </>
          ) : (
            <>
              <LoaderCircle size={14} aria-hidden className="animate-spin" />
              Generating…
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function BlogCard({ state }: { state: CardState }) {
  switch (state.kind) {
    case "done":
      return <DoneCard idea={state.idea} blog={state.blog} />;
    case "writing":
      return <WritingCard idea={state.idea} blog={state.blog} />;
    case "humanizing":
      return <HumanizingCard idea={state.idea} />;
    case "failed":
      return <FailedCard idea={state.idea} blog={state.blog} />;
    case "queued":
    default:
      return <QueuedCard idea={state.idea} />;
  }
}

function DoneCard({ idea, blog }: { idea: IdeaDTO; blog: BlogDTO }) {
  return (
    <li className="flex items-start gap-4 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary-container">
      <CircleCheckBig
        size={20}
        aria-hidden
        className="mt-1 flex-shrink-0 text-primary-container"
      />
      <div className="min-w-0 flex-grow">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-serif text-base font-medium text-fg">
            {idea.title}
          </h3>
          <Badge variant="optimized">Done</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-fg-muted">
          {blog.wordCount ? (
            <span className="inline-flex items-center gap-1">
              <NotebookPen size={14} aria-hidden />
              {blog.wordCount.toLocaleString()} words
            </span>
          ) : null}
          {blog.humanizationFailed ? (
            <Badge variant="warning">humanization skipped — raw only</Badge>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function WritingCard({ idea, blog }: { idea: IdeaDTO; blog: BlogDTO }) {
  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-lg border border-primary-container/60 bg-surface p-5",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary-container/[0.06] to-transparent"
      />
      <div className="relative z-10 flex items-start gap-4">
        <LoaderCircle
          size={20}
          aria-hidden
          className="mt-1 flex-shrink-0 animate-spin text-primary-container"
        />
        <div className="min-w-0 flex-grow">
          <div className="flex items-start justify-between gap-3">
            <h3 className="truncate font-serif text-base font-medium text-fg">
              {idea.title}
            </h3>
            <Badge
              variant="neutral"
              className="border border-primary-container/30 bg-surface-high text-primary-container"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-container" />
              Writing…
            </Badge>
          </div>
          <p className="mt-2 text-xs text-fg-muted">
            Streaming Markdown for a {idea.wordCountTarget.toLocaleString()}
            -word post.
          </p>
          <div className="mt-3 space-y-1.5" aria-hidden>
            <div className="h-2.5 w-3/4 animate-pulse rounded bg-surface-high/70" />
            <div className="h-2.5 w-5/6 animate-pulse rounded bg-surface-high/70" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-surface-high/70" />
          </div>
          {blog.wordCount ? (
            <p className="mt-3 inline-flex items-center gap-1 text-xs text-fg-muted">
              <NotebookPen size={14} aria-hidden />
              {blog.wordCount.toLocaleString()} words generated
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function HumanizingCard({ idea }: { idea: IdeaDTO }) {
  return (
    <li className="flex items-start gap-4 rounded-lg border border-border bg-surface p-5">
      <LoaderCircle
        size={20}
        aria-hidden
        className="mt-1 flex-shrink-0 animate-spin text-primary-container"
      />
      <div className="min-w-0 flex-grow">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-serif text-base font-medium text-fg">
            {idea.title}
          </h3>
          <Badge variant="neutral">Humanizing…</Badge>
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          Smoothing the draft through the humanization pass.
        </p>
      </div>
    </li>
  );
}

function QueuedCard({ idea }: { idea: IdeaDTO }) {
  return (
    <li className="flex items-start gap-4 rounded-lg border border-border/60 bg-surface p-5 opacity-70">
      <CircleDashed
        size={20}
        aria-hidden
        className="mt-1 flex-shrink-0 text-fg-muted"
      />
      <div className="min-w-0 flex-grow">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-serif text-base font-medium text-fg-muted">
            {idea.title}
          </h3>
          <Badge variant="neutral">Queued</Badge>
        </div>
        <p className="mt-1 text-xs text-fg-muted/80">
          Waiting for the writer to free up.
        </p>
      </div>
    </li>
  );
}

function FailedCard({ idea, blog }: { idea: IdeaDTO; blog: BlogDTO }) {
  return (
    <li className="flex items-start gap-4 rounded-lg border border-error/30 bg-error/5 p-5">
      <CircleAlert
        size={20}
        aria-hidden
        className="mt-1 flex-shrink-0 text-error"
      />
      <div className="min-w-0 flex-grow">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-serif text-base font-medium text-fg">
            {idea.title}
          </h3>
          <Badge variant="error">Failed</Badge>
        </div>
        <p className="mt-2 text-xs text-error/90">
          {blog.failureReason ?? "The writer failed twice. Skipping this blog."}
        </p>
      </div>
    </li>
  );
}
