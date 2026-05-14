"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockOpen } from "lucide-react";
import { cn } from "@/lib/cn";

interface LoginFormProps {
  redirectTo: string;
}

interface LoginResponse {
  ok?: boolean;
  error?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data: LoginResponse = await response
        .json()
        .catch(() => ({}) as LoginResponse);

      if (!response.ok || !data.ok) {
        setError(data.error ?? "Unable to sign in. Try again.");
        setSubmitting(false);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  const disabled = submitting || password.length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded border border-error/30 bg-error/15 px-3 py-2 text-sm text-error"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-xs font-medium uppercase tracking-wider text-fg-muted"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
            disabled={submitting}
            className={cn(
              "h-12 w-full rounded border border-border bg-surface-container px-4 pr-12 text-sm text-fg",
              "placeholder:text-fg-muted/60 transition-colors",
              "focus-visible:border-primary-container focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-container",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-fg-muted transition-colors hover:text-fg"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" aria-hidden />
            ) : (
              <Eye className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded bg-primary-container py-3 text-sm font-medium text-on-primary",
          "transition-colors hover:bg-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <LockOpen className="h-[18px] w-[18px]" aria-hidden />
        {submitting ? "Unlocking..." : "Unlock"}
      </button>
    </form>
  );
}
