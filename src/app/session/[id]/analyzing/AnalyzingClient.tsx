"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Circle,
  CircleCheckBig,
  LoaderCircle,
  RefreshCw,
  ScanSearch,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { SessionDTO, SessionStatus } from "@/types";

interface AnalyzingClientProps {
  sessionId: string;
  initialSession: SessionDTO;
}

// Copy mirrors the Stitch screen (id 59e778cff8ee499183a18371d17b4b15).
const STEPS = [
  {
    title: "Crawling URLs",
    helper: "Mapping pages, blog index, and resources.",
  },
  {
    title: "Analyzing keyword density",
    helper: "Checking tone, audience, and SERP competitors.",
  },
  {
    title: "Generating SEO recommendations",
    helper: "Surfacing content gaps and differentiation hooks.",
  },
] as const;

const POLL_INTERVAL_MS = 2000;
const STEP_ADVANCE_MS = 9000;

type StepState = "done" | "active" | "pending";

function getStepState(stepIndex: number, activeIndex: number): StepState {
  if (stepIndex < activeIndex) return "done";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}

export function AnalyzingClient({
  sessionId,
  initialSession,
}: AnalyzingClientProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<SessionStatus>(
    initialSession.status,
  );
  const [failureReason, setFailureReason] = React.useState<string | undefined>(
    initialSession.failureReason,
  );
  const [activeStep, setActiveStep] = React.useState(0);
  const [retryNonce, setRetryNonce] = React.useState(0);
  const kickedOff = React.useRef(false);

  // 1) Kick off the analyze request once per mount / retry.
  React.useEffect(() => {
    if (kickedOff.current) return;
    if (status !== "created" && status !== "analyzing" && status !== "failed") {
      return;
    }
    kickedOff.current = true;

    fetch(`/api/sessions/${sessionId}/analyze`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setFailureReason(body.error ?? `Analyze failed (${res.status})`);
          setStatus("failed");
        }
      })
      .catch((err: unknown) => {
        setFailureReason(err instanceof Error ? err.message : "Network error");
        setStatus("failed");
      });
  }, [sessionId, status, retryNonce]);

  // 2) Poll the session every 2s while in-progress.
  React.useEffect(() => {
    if (status !== "created" && status !== "analyzing") return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { session?: SessionDTO };
        if (cancelled || !body.session) return;
        setStatus(body.session.status);
        setFailureReason(body.session.failureReason);
      } catch {
        // Swallow transient errors and rely on the next tick.
      }
    };
    const handle = window.setInterval(tick, POLL_INTERVAL_MS);
    // Fire one immediate poll so a flipped status isn't gated by the interval.
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [sessionId, status]);

  // 3) Cycle the visual stepper while in-progress.
  React.useEffect(() => {
    if (status !== "created" && status !== "analyzing") return;
    const handle = window.setInterval(() => {
      setActiveStep((idx) => Math.min(idx + 1, STEPS.length - 1));
    }, STEP_ADVANCE_MS);
    return () => window.clearInterval(handle);
  }, [status]);

  // 4) Redirect once the status moves on.
  React.useEffect(() => {
    if (status === "ideas_pending" || status === "ideas_approved") {
      router.replace(`/session/${sessionId}/ideas`);
    } else if (status === "generating" || status === "humanizing") {
      router.replace(`/session/${sessionId}/generating`);
    } else if (status === "done") {
      router.replace(`/session/${sessionId}/export`);
    }
  }, [router, sessionId, status]);

  const handleRetry = React.useCallback(() => {
    kickedOff.current = false;
    setStatus("created");
    setActiveStep(0);
    setFailureReason(undefined);
    setRetryNonce((n) => n + 1);
  }, []);

  const isFailed = status === "failed";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center">
      <div className="w-full max-w-xl rounded-lg border border-border bg-surface p-8">
        <header className="mb-6 flex flex-col items-center text-center">
          <IconBadge failed={isFailed} />
          <h1 className="mt-4 font-serif text-2xl font-semibold text-fg">
            {isFailed ? "Analysis failed" : "Analyzing your site…"}
          </h1>
          <p className="mt-1 max-w-sm text-sm text-fg-muted">
            {isFailed
              ? "We couldn’t finish the analysis. Try again, or revisit the inputs in History."
              : `BlogForge is reading ${initialSession.websiteUrl} to brief the blog ideas.`}
          </p>
        </header>

        {isFailed ? (
          <FailureBanner reason={failureReason} />
        ) : (
          <Stepper activeStep={activeStep} />
        )}

        <footer className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-fg-muted">
            {isFailed
              ? "Retry to re-run web search and rebuild the brief."
              : (
                <>
                  This usually takes{" "}
                  <span className="font-medium text-fg">2–3 min</span>
                </>
              )}
          </p>
          {isFailed ? (
            <Button onClick={handleRetry} size="sm">
              <RefreshCw size={14} aria-hidden />
              Retry analysis
            </Button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

function IconBadge({ failed }: { failed: boolean }) {
  return (
    <div className="relative grid h-16 w-16 place-items-center">
      {!failed ? (
        <>
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full border-2 border-primary-container/30 opacity-75"
          />
          <span
            aria-hidden
            className="absolute inset-2 animate-pulse rounded-full border border-primary-container/40"
          />
        </>
      ) : null}
      <span
        className={cn(
          "relative z-10 grid h-12 w-12 place-items-center rounded-full border border-border bg-surface-high",
          failed ? "text-error" : "text-primary-container",
        )}
      >
        {failed ? (
          <TriangleAlert size={22} aria-hidden />
        ) : (
          <ScanSearch size={22} aria-hidden />
        )}
      </span>
    </div>
  );
}

function Stepper({ activeStep }: { activeStep: number }) {
  return (
    <ol className="mx-auto mb-6 flex w-full max-w-sm flex-col" aria-live="polite">
      {STEPS.map((step, idx) => {
        const state = getStepState(idx, activeStep);
        const isLast = idx === STEPS.length - 1;
        return (
          <li
            key={step.title}
            className={cn(
              "relative flex items-start gap-3",
              !isLast && "pb-6",
            )}
          >
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[11px] top-[24px] bottom-0 w-px",
                  state === "pending" ? "bg-border/50" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "z-10 mt-0.5 grid h-6 w-6 place-items-center rounded-full border",
                state === "done" &&
                  "border-primary-container/60 bg-surface text-primary-container",
                state === "active" &&
                  "border-fg/40 bg-surface text-fg",
                state === "pending" &&
                  "border-border bg-surface text-outline",
              )}
            >
              {state === "done" ? (
                <CircleCheckBig size={16} aria-hidden />
              ) : state === "active" ? (
                <LoaderCircle size={16} aria-hidden className="animate-spin" />
              ) : (
                <Circle size={14} aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-medium",
                  state === "pending" ? "text-fg-muted" : "text-fg",
                )}
              >
                {step.title}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  state === "pending" ? "text-outline" : "text-fg-muted",
                )}
              >
                {step.helper}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function FailureBanner({ reason }: { reason?: string }) {
  return (
    <div
      role="alert"
      className="mb-6 rounded border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
    >
      <p className="font-medium text-error">Analysis could not complete.</p>
      <p className="mt-1 text-xs text-error/90">
        {reason ?? "An unknown error occurred. Retry to try again."}
      </p>
    </div>
  );
}
