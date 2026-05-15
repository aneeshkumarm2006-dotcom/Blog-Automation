"use client";

import * as React from "react";

/**
 * Browser `Notification` helpers for closing the loop on long generation
 * batches. The user tends to tab away during a 10-blog × ~60s run, so we ping
 * the OS notification center the moment the session lands at `done`.
 *
 * Everything here degrades silently when the API is unavailable (SSR,
 * unsupported browser, or permission denied) — generation never depends on it.
 */

function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Ask for permission if the user hasn't decided yet. Safe to call repeatedly;
 * the browser only prompts on the first `default` state. Called while a batch
 * is actively running so the prompt lands while the user still cares.
 */
export function requestNotificationPermission(): void {
  if (!notificationsSupported()) return;
  if (Notification.permission !== "default") return;
  // Some browsers reject the promise instead of resolving "denied".
  void Notification.requestPermission().catch(() => {});
}

interface CompleteNotificationArgs {
  sessionName: string;
  completed: number;
  total: number;
  /** Where clicking the notification should take the user. */
  url: string;
}

/**
 * Fire the "batch finished" notification. No-ops unless permission is granted
 * AND the tab is backgrounded — notifying a user who is already watching the
 * progress screen is just noise.
 */
export function notifyGenerationComplete({
  sessionName,
  completed,
  total,
  url,
}: CompleteNotificationArgs): void {
  if (!notificationsSupported()) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible")
    return;

  try {
    const notification = new Notification("Blog generation finished", {
      body: `${sessionName} — ${completed}/${total} blogs generated.`,
      tag: `blogforge-session-${url}`,
      icon: "/favicon.ico",
    });
    notification.onclick = () => {
      window.focus();
      if (window.location.pathname !== url) window.location.href = url;
      notification.close();
    };
  } catch {
    // Constructing a Notification can throw on some mobile browsers even when
    // permission is "granted". Nothing to recover — the in-app redirect still
    // closes the loop.
  }
}

/**
 * Requests permission while a batch is running and fires exactly one
 * notification on the transition into `done`. Pass the live session status;
 * the hook tracks the previous value internally so it only pings on the edge,
 * not on every render where the status is already `done`.
 */
export function useGenerationCompleteNotification(args: {
  status: string;
  isRunning: boolean;
  sessionName: string;
  completed: number;
  total: number;
  url: string;
}): void {
  const { status, isRunning, sessionName, completed, total, url } = args;
  const prevStatus = React.useRef(status);
  const fired = React.useRef(false);

  // Prompt for permission once the batch is actively generating.
  React.useEffect(() => {
    if (isRunning) requestNotificationPermission();
  }, [isRunning]);

  React.useEffect(() => {
    const wasDone = prevStatus.current === "done";
    prevStatus.current = status;
    if (status === "done" && !wasDone && !fired.current) {
      fired.current = true;
      notifyGenerationComplete({ sessionName, completed, total, url });
    }
  }, [status, sessionName, completed, total, url]);
}
