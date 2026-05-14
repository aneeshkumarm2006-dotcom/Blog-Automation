import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { AppShell } from "@/components/layout/AppShell";
import { getSession, toClientSession } from "@/lib/db";
import { AnalyzingClient } from "./AnalyzingClient";

export const metadata: Metadata = {
  title: "Analyzing Site... — BlogForge",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnalyzingPage({ params }: PageProps) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    redirect("/history");
  }

  const session = await getSession(id);
  if (!session) {
    redirect("/history");
  }

  // Short-circuit if the session has already moved past the analyze stage.
  switch (session.status) {
    case "ideas_pending":
    case "ideas_approved":
      redirect(`/session/${id}/ideas`);
    case "generating":
    case "humanizing":
      redirect(`/session/${id}/generating`);
    case "done":
      redirect(`/session/${id}/export`);
    default:
      break;
  }

  return (
    <AppShell width="wide" footerSlot={<span>Personal use only</span>}>
      <AnalyzingClient
        sessionId={id}
        initialSession={toClientSession(session)}
      />
    </AppShell>
  );
}
