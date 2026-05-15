"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { newProjectSchema } from "@/lib/schemas";

interface ZodIssueLike {
  path: ReadonlyArray<string | number>;
  message: string;
}

interface FormErrors {
  name?: string;
  websiteUrl?: string;
  form?: string;
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

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<FormErrors>({});

  function applyZodIssues(issues: ReadonlyArray<ZodIssueLike>) {
    const next: FormErrors = {};
    for (const issue of issues) {
      const [first] = issue.path;
      if (first === "name") {
        next.name = next.name ?? issue.message;
      } else if (first === "websiteUrl") {
        next.websiteUrl = next.websiteUrl ?? issue.message;
      } else {
        next.form = next.form ?? issue.message;
      }
    }
    setErrors(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setErrors({});

    const payload = {
      name: name.trim(),
      websiteUrl: websiteUrl.trim(),
    };

    const parsed = newProjectSchema.safeParse(payload);
    if (!parsed.success) {
      applyZodIssues(parsed.error.issues as ReadonlyArray<ZodIssueLike>);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
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
            form: data.error ?? "Failed to create project. Try again.",
          });
        }
        setSubmitting(false);
        return;
      }

      router.replace(`/projects/${data.id}/analyzing`);
      router.refresh();
    } catch (err) {
      setErrors({
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
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Pick a name you&apos;ll recognise later, and the website Blog Automation 
            should analyze.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="name">{fieldLabel("Project name")}</label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Acme Marketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              aria-invalid={errors.name ? true : undefined}
            />
            <FieldError message={errors.name} />
          </div>
          <div>
            <label htmlFor="websiteUrl">{fieldLabel("Website URL")}</label>
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
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" disabled={submitting}>
          <Wand2 size={16} aria-hidden />
          {submitting ? "Creating project..." : "Create & Analyze Site"}
        </Button>
      </div>
    </form>
  );
}
