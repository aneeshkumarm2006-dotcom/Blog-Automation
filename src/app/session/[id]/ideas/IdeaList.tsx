"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Square,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { IdeaDTO, SessionDTO } from "@/types";

interface IdeaListProps {
  sessionId: string;
  initialSession: SessionDTO;
  initialIdeas: IdeaDTO[];
}

type IdeasResponse = { ideas: IdeaDTO[]; error?: string };
type IdeaUpdateResponse = { idea: IdeaDTO; error?: string };

const INTENT_LABELS: Record<string, string> = {
  informational: "Informational",
  commercial: "Commercial",
  transactional: "Transactional",
  navigational: "Navigational",
};

export function IdeaList({
  sessionId,
  initialSession,
  initialIdeas,
}: IdeaListProps) {
  const router = useRouter();
  const [ideas, setIdeas] = React.useState<IdeaDTO[]>(initialIdeas);
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initialIdeas.map((i) => i._id)),
  );
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | undefined>();
  const [generating, setGenerating] = React.useState(initialIdeas.length === 0);
  const [regenerating, setRegenerating] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const generationStarted = React.useRef(false);

  // Initial generation: if no ideas yet, POST to /ideas once.
  React.useEffect(() => {
    if (generationStarted.current) return;
    if (initialIdeas.length > 0) return;
    generationStarted.current = true;
    // `generating` is already true (initial state mirrors initialIdeas.length === 0).
    void generate();

    async function generate() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/ideas`, {
          method: "POST",
        });
        const body = (await res.json().catch(() => ({}))) as IdeasResponse;
        if (!res.ok) {
          setError(body.error ?? `Idea generation failed (${res.status})`);
          return;
        }
        setIdeas(body.ideas);
        setSelected(new Set(body.ideas.map((i) => i._id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setGenerating(false);
      }
    }
  }, [initialIdeas.length, sessionId]);

  const toggleSelected = React.useCallback((ideaId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ideaId)) next.delete(ideaId);
      else next.add(ideaId);
      return next;
    });
  }, []);

  const toggleExpanded = React.useCallback((ideaId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ideaId)) next.delete(ideaId);
      else next.add(ideaId);
      return next;
    });
  }, []);

  const patchIdea = React.useCallback(
    async (ideaId: string, patch: Partial<IdeaDTO>) => {
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/ideas/${ideaId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        const body = (await res.json().catch(() => ({}))) as IdeaUpdateResponse;
        if (!res.ok) {
          setError(body.error ?? `Failed to update idea (${res.status})`);
          return;
        }
        setIdeas((prev) =>
          prev.map((i) => (i._id === ideaId ? body.idea : i)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      }
    },
    [sessionId],
  );

  const removeIdea = React.useCallback(
    async (ideaId: string) => {
      const previous = ideas;
      setIdeas((prev) => prev.filter((i) => i._id !== ideaId));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/ideas/${ideaId}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error ?? `Failed to delete idea (${res.status})`);
          setIdeas(previous);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        setIdeas(previous);
      }
    },
    [ideas, sessionId],
  );

  const regenerate = React.useCallback(
    async (ideaIds: string[]) => {
      if (ideaIds.length === 0) return;
      setRegenerating(true);
      setError(undefined);
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/ideas/regenerate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ideaIds }),
          },
        );
        const body = (await res.json().catch(() => ({}))) as IdeasResponse;
        if (!res.ok) {
          setError(body.error ?? `Failed to regenerate (${res.status})`);
          return;
        }
        // Drop the targeted ideas; append fresh ones.
        const targets = new Set(ideaIds);
        setIdeas((prev) => [
          ...prev.filter((i) => !targets.has(i._id)),
          ...body.ideas,
        ]);
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of ideaIds) next.delete(id);
          for (const fresh of body.ideas) next.add(fresh._id);
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setRegenerating(false);
      }
    },
    [sessionId],
  );

  const handleRegenerateSelected = React.useCallback(() => {
    void regenerate(Array.from(selected));
  }, [regenerate, selected]);

  // Used by the empty state: all live ideas were deleted, so call the initial
  // generation endpoint to draft a fresh batch from session.keywordPairs.
  const handleGenerateFromScratch = React.useCallback(async () => {
    setRegenerating(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/ideas`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as IdeasResponse;
      if (!res.ok) {
        setError(body.error ?? `Idea generation failed (${res.status})`);
        return;
      }
      setIdeas(body.ideas);
      setSelected(new Set(body.ideas.map((i) => i._id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRegenerating(false);
    }
  }, [sessionId]);

  const approve = React.useCallback(async () => {
    setApproving(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/approve`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? `Failed to approve (${res.status})`);
        setApproving(false);
        return;
      }
      router.replace(`/session/${sessionId}/generating`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setApproving(false);
    }
  }, [router, sessionId]);

  const everyIdeaHasValidPair = ideas.every((idea) =>
    initialSession.keywordPairs.some(
      (p) =>
        p.keyword === idea.assignedKeyword &&
        p.backlink === idea.assignedBacklink,
    ),
  );
  const canApprove =
    ideas.length > 0 &&
    everyIdeaHasValidPair &&
    !approving &&
    !generating &&
    !regenerating;

  return (
    <div className="flex flex-col">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-fg-muted">
          Step 2 of 3
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-fg">
          Review &amp; Approve Blog Ideas
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Targeting{" "}
          <span className="text-fg">{initialSession.websiteUrl}</span>. Edit
          titles, swap keyword assignments, or delete any idea before kicking
          off the writers.
        </p>
      </header>

      <AnalysisSnapshot session={initialSession} />

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

      {generating ? (
        <GeneratingPlaceholder count={initialSession.blogCount} />
      ) : ideas.length === 0 ? (
        <EmptyState
          onRegenerate={handleGenerateFromScratch}
          regenerating={regenerating}
        />
      ) : (
        <ol className="mb-12 flex flex-col gap-3">
          {ideas.map((idea) => (
            <IdeaRow
              key={idea._id}
              idea={idea}
              keywordPairs={initialSession.keywordPairs}
              selected={selected.has(idea._id)}
              expanded={expanded.has(idea._id)}
              onToggleSelected={() => toggleSelected(idea._id)}
              onToggleExpanded={() => toggleExpanded(idea._id)}
              onPatch={(patch) => patchIdea(idea._id, patch)}
              onDelete={() => removeIdea(idea._id)}
            />
          ))}
        </ol>
      )}

      <footer className="mt-auto flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-fg-muted">
          {generating
            ? "Generating ideas…"
            : `${ideas.length} of ${initialSession.blogCount} idea${initialSession.blogCount === 1 ? "" : "s"} live · ${selected.size} selected`}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerateSelected}
            disabled={regenerating || generating || selected.size === 0}
          >
            {regenerating ? (
              <LoaderCircle size={14} aria-hidden className="animate-spin" />
            ) : (
              <RefreshCw size={14} aria-hidden />
            )}
            Regenerate selected
          </Button>
          <Button
            size="sm"
            onClick={approve}
            disabled={!canApprove}
            className="px-5"
          >
            {approving ? (
              <LoaderCircle size={14} aria-hidden className="animate-spin" />
            ) : null}
            Generate Blogs
            {!approving ? <ArrowRight size={16} aria-hidden /> : null}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function AnalysisSnapshot({ session }: { session: SessionDTO }) {
  const [open, setOpen] = React.useState(false);
  const analysis = session.siteAnalysis;
  if (!analysis) return null;

  const gaps = analysis.content_gaps?.filter(Boolean) ?? [];
  const hooks = analysis.differentiation_hooks?.filter(Boolean) ?? [];
  const audience = analysis.audience?.primary;
  const niche = analysis.niche;

  const summary = [
    niche ? `Niche: ${niche}` : null,
    audience ? `Audience: ${audience}` : null,
    gaps.length ? `${gaps.length} content gap${gaps.length === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mb-8 rounded-lg border border-border bg-surface p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
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
          <h2 className="font-serif text-base font-semibold text-fg">
            Market Analysis Snapshot
          </h2>
          <p className="mt-1 truncate text-sm text-fg-muted">
            {summary || "Site analysis complete."}
          </p>
        </div>
      </button>
      {open ? (
        <div className="mt-4 grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-2">
          {gaps.length > 0 ? (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-fg-muted">
                Content gaps
              </p>
              <ul className="list-disc space-y-1 pl-4 text-fg">
                {gaps.slice(0, 4).map((gap) => (
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
                {hooks.slice(0, 4).map((hook) => (
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

interface IdeaRowProps {
  idea: IdeaDTO;
  keywordPairs: SessionDTO["keywordPairs"];
  selected: boolean;
  expanded: boolean;
  onToggleSelected: () => void;
  onToggleExpanded: () => void;
  onPatch: (patch: Partial<IdeaDTO>) => void;
  onDelete: () => void;
}

function IdeaRow({
  idea,
  keywordPairs,
  selected,
  expanded,
  onToggleSelected,
  onToggleExpanded,
  onPatch,
  onDelete,
}: IdeaRowProps) {
  // Rows are keyed by idea._id, so a regenerated idea replaces this component
  // instance and reinitializes local state. Patches that succeed update the
  // parent's idea.title/angle to the same value we already hold here, so an
  // explicit sync-from-prop is unnecessary (and would violate
  // react-hooks/set-state-in-effect).
  const [title, setTitle] = React.useState(idea.title);
  const [angle, setAngle] = React.useState(idea.angle);

  const intentLabel =
    INTENT_LABELS[idea.searchIntent?.toLowerCase()] ?? idea.searchIntent;

  const pairValue = `${idea.assignedKeyword}::${idea.assignedBacklink}`;

  return (
    <li className="group rounded-lg border border-border bg-surface transition-colors hover:border-primary-container/60">
      <div className="flex items-start gap-4 p-4">
        <button
          type="button"
          onClick={onToggleSelected}
          className="mt-1 flex-shrink-0 text-primary-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          aria-label={selected ? "Deselect idea" : "Select idea"}
          aria-pressed={selected}
        >
          {selected ? (
            <CheckSquare size={20} aria-hidden />
          ) : (
            <Square size={20} aria-hidden className="text-fg-muted" />
          )}
        </button>

        <div className="flex min-w-0 flex-grow flex-col gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== idea.title) {
                onPatch({ title: title.trim() });
              } else if (!title.trim()) {
                setTitle(idea.title);
              }
            }}
            className={cn(
              "w-full rounded-none border-0 border-b border-transparent bg-transparent p-0 font-serif text-lg font-medium text-fg",
              "focus:border-primary focus:outline-none focus:ring-0",
            )}
            aria-label="Idea title"
          />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pairValue}
              onChange={(e) => {
                const [keyword, ...rest] = e.target.value.split("::");
                const backlink = rest.join("::");
                if (!keyword || !backlink) return;
                onPatch({
                  assignedKeyword: keyword,
                  assignedBacklink: backlink,
                });
              }}
              className={cn(
                "h-7 max-w-full rounded-sm border border-border bg-surface-high px-2 text-xs text-fg-muted",
                "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
              )}
              aria-label="Assigned keyword"
            >
              {keywordPairs.map((p) => {
                const value = `${p.keyword}::${p.backlink}`;
                return (
                  <option key={value} value={value}>
                    {p.keyword}
                  </option>
                );
              })}
            </select>
            <span
              className="rounded-sm border border-border bg-surface-high px-2 py-0.5 text-xs text-fg-muted"
              title={`Search intent: ${intentLabel}`}
            >
              {intentLabel}
            </span>
            <span
              className="max-w-[18rem] truncate rounded-sm border border-border bg-surface-high px-2 py-0.5 text-xs text-fg-muted"
              title={idea.assignedBacklink}
            >
              {hostOf(idea.assignedBacklink)}
            </span>
            <button
              type="button"
              onClick={onToggleExpanded}
              className="ml-auto inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown size={14} aria-hidden />
              ) : (
                <ChevronRight size={14} aria-hidden />
              )}
              Angle
            </button>
          </div>

          {expanded ? (
            <div className="mt-1 flex flex-col gap-2 rounded border border-border bg-surface p-3">
              <label className="text-xs uppercase tracking-wider text-fg-muted">
                Angle
              </label>
              <textarea
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                onBlur={() => {
                  if (angle.trim() && angle !== idea.angle) {
                    onPatch({ angle: angle.trim() });
                  } else if (!angle.trim()) {
                    setAngle(idea.angle);
                  }
                }}
                rows={4}
                className={cn(
                  "w-full rounded border border-border bg-surface p-2 text-sm text-fg",
                  "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
                )}
              />
              {idea.uniqueValueHook ? (
                <p className="text-xs text-fg-muted">
                  <span className="text-fg-muted">Unique hook:</span>{" "}
                  {idea.uniqueValueHook}
                </p>
              ) : null}
              {idea.primaryGapAddressed ? (
                <p className="text-xs text-fg-muted">
                  <span className="text-fg-muted">Gap addressed:</span>{" "}
                  {idea.primaryGapAddressed}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-container hover:text-error"
            aria-label="Delete idea"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function GeneratingPlaceholder({ count }: { count: number }) {
  return (
    <div className="mb-12 flex flex-col gap-3" aria-busy="true">
      {Array.from({ length: Math.max(1, Math.min(count, 5)) }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
        >
          <span
            aria-hidden
            className="h-5 w-5 flex-shrink-0 animate-pulse rounded-sm bg-surface-high"
          />
          <div className="flex flex-grow flex-col gap-2">
            <span
              aria-hidden
              className="h-4 w-3/4 animate-pulse rounded bg-surface-high"
            />
            <span
              aria-hidden
              className="h-3 w-1/2 animate-pulse rounded bg-surface-high/70"
            />
          </div>
        </div>
      ))}
      <p className="mt-2 inline-flex items-center gap-2 text-sm text-fg-muted">
        <LoaderCircle size={14} aria-hidden className="animate-spin" />
        Drafting {count} blog idea{count === 1 ? "" : "s"} from your site
        analysis…
      </p>
    </div>
  );
}

function EmptyState({
  onRegenerate,
  regenerating,
}: {
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <div className="mb-12 rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <h2 className="font-serif text-lg font-semibold text-fg">
        No ideas to generate
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        Regenerate to draft a fresh batch from your site analysis.
      </p>
      <div className="mt-4 inline-flex">
        <Button size="sm" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? (
            <LoaderCircle size={14} aria-hidden className="animate-spin" />
          ) : (
            <RefreshCw size={14} aria-hidden />
          )}
          Regenerate ideas
        </Button>
      </div>
    </div>
  );
}
