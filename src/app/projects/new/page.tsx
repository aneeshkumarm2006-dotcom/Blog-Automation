import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { NewProjectForm } from "./NewProjectForm";

export const metadata: Metadata = {
  title: "New Project — Blog Automation",
};

export default function NewProjectPage() {
  return (
    <AppShell>
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-fg-muted">
          Create a project
        </p>
        <h1 className="font-serif text-3xl font-semibold text-fg">
          New Project
        </h1>
        <p className="mt-2 max-w-prose text-sm text-fg-muted">
          Give the project a name and point Blog Automation at the website. We&apos;ll
          analyze the site once, then reuse the analysis on every batch of
          blogs you generate inside it.
        </p>
      </header>

      <NewProjectForm />
    </AppShell>
  );
}
