"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { newSessionSchema } from "@/lib/schemas";

interface ZodIssueLike {
  path: ReadonlyArray<string | number>;
  message: string;
}

interface PairRow {
  id: string;
  keyword: string;
  backlink: string;
}

interface RowErrors {
  keyword?: string;
  backlink?: string;
}

interface FormErrors {
  websiteUrl?: string;
  rows: Record<string, RowErrors>;
  keywordPairs?: string;
  blogCount?: string;
  wordCount?: string;
  form?: string;
}

const EMPTY_ERRORS: FormErrors = { rows: {} };

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

function fieldLabel(text: string): React.ReactNode {
  return (
    <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-muted">
      {text}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-error">
      {message}
    </p>
  );
}

export function NewSessionForm() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [rows, setRows] = React.useState<PairRow[]>(() => [newRow()]);
  const [blogCount, setBlogCount] = React.useState<number>(1);
  const [wordCount, setWordCount] = React.useState<number>(1500);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<FormErrors>(EMPTY_ERRORS);

  function addRow() {
    setRows((current) => {
      const next = [...current, newRow()];
      setBlogCount(next.length);
      return next;
    });
  }

  function removeRow(id: string) {
    setRows((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((r) => r.id !== id);
      setBlogCount(next.length);
      return next;
    });
  }

  function updateRow(id: string, patch: Partial<Omit<PairRow, "id">>) {
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function applyZodIssues(issues: ReadonlyArray<ZodIssueLike>) {
    const next: FormErrors = { rows: {} };
    for (const issue of issues) {
      const [first, second, third] = issue.path;
      if (first === undefined) {
        next.form = next.form ?? issue.message;
        continue;
      }
      if (first === "websiteUrl") {
        next.websiteUrl = next.websiteUrl ?? issue.message;
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
    setErrors(EMPTY_ERRORS);

    const payload = {
      websiteUrl: websiteUrl.trim(),
      keywordPairs: rows.map(({ keyword, backlink }) => ({
        keyword: keyword.trim(),
        backlink: backlink.trim(),
      })),
      blogCount,
      wordCount,
    };

    const parsed = newSessionSchema.safeParse(payload);
    if (!parsed.success) {
      applyZodIssues(parsed.error.issues as ReadonlyArray<ZodIssueLike>);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        issues?: ReadonlyArray<ZodIssueLike>;
      };

      if (!res.ok || !data.id) {
        if (data.issues) {
          applyZodIssues(data.issues);
        } else {
          setErrors({
            rows: {},
            form: data.error ?? "Failed to create session. Try again.",
          });
        }
        setSubmitting(false);
        return;
      }

      router.replace(`/session/${data.id}/analyzing`);
      router.refresh();
    } catch (err) {
      setErrors({
        rows: {},
        form: err instanceof Error ? err.message : "Network error",
      });
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {errors.form ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded border border-error/30 bg-error/15 px-3 py-2 text-sm text-error"
        >
          {errors.form}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Website URL</CardTitle>
          <CardDescription>
            The site BlogForge will analyze for niche, audience, and content gaps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label htmlFor="websiteUrl">{fieldLabel("Website")}</label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            disabled={submitting}
            aria-invalid={errors.websiteUrl ? true : undefined}
          />
          <FieldError message={errors.websiteUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyword & Backlink Pairs</CardTitle>
          <CardDescription>
            Each pair becomes one blog. Up to 20 pairs.
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
                    <FieldError message={rowErr?.keyword} />
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
                    <FieldError message={rowErr?.backlink} />
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Number of Blogs</CardTitle>
            <CardDescription>
              Must equal the number of keyword pairs (1–20).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label htmlFor="blogCount">{fieldLabel("Blogs")}</label>
            <Input
              id="blogCount"
              name="blogCount"
              type="number"
              min={1}
              max={20}
              step={1}
              value={blogCount}
              onChange={(e) => {
                const raw = e.target.valueAsNumber;
                setBlogCount(Number.isFinite(raw) ? raw : 0);
              }}
              disabled={submitting}
              aria-invalid={errors.blogCount ? true : undefined}
            />
            <FieldError message={errors.blogCount} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Word Count Per Blog</CardTitle>
            <CardDescription>
              500 to 4000 words, in increments of 250.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label htmlFor="wordCount">{fieldLabel("Words")}</label>
            <Input
              id="wordCount"
              name="wordCount"
              type="number"
              min={500}
              max={4000}
              step={250}
              value={wordCount}
              onChange={(e) => {
                const raw = e.target.valueAsNumber;
                setWordCount(Number.isFinite(raw) ? raw : 0);
              }}
              disabled={submitting}
              aria-invalid={errors.wordCount ? true : undefined}
            />
            <FieldError message={errors.wordCount} />
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={submitting}>
          <Wand2 size={16} aria-hidden />
          {submitting ? "Creating session..." : "Analyze Site & Generate Ideas"}
        </Button>
      </div>
    </form>
  );
}
