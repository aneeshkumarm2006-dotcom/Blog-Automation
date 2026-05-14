import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { NewSessionForm } from "./NewSessionForm";

export const metadata: Metadata = {
  title: "New Session — BlogForge",
};

export default function NewSessionPage() {
  return (
    <AppShell footerSlot={<span>Personal use only</span>}>
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-fg-muted">
          Step 1 of 3
        </p>
        <h1 className="font-serif text-3xl font-semibold text-fg">
          New Blog Session
        </h1>
        <p className="mt-2 max-w-prose text-sm text-fg-muted">
          Point BlogForge at a site, attach the keyword/backlink pairs you want
          to rank, and set the article length. We&apos;ll analyze the site and
          draft blog ideas for your approval.
        </p>
      </header>

      <NewSessionForm />
    </AppShell>
  );
}
