import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { AppShell } from "@/components/layout/AppShell";
import {
  getSession,
  listIdeas,
  toClientIdea,
  toClientSession,
} from "@/lib/db";
import { IdeaList } from "./IdeaList";

export const metadata: Metadata = {
  title: "Approve Ideas — BlogForge",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApproveIdeasPage({ params }: PageProps) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    redirect("/history");
  }

  const session = await getSession(id);
  if (!session) {
    redirect("/history");
  }

  // Route by session status: bounce back to the analyzing screen if the site
  // analysis isn't done yet, or forward to generating/export if past approval.
  switch (session.status) {
    case "created":
    case "analyzing":
    case "failed":
      redirect(`/session/${id}/analyzing`);
    case "ideas_approved":
    case "generating":
    case "humanizing":
      redirect(`/session/${id}/generating`);
    case "done":
      redirect(`/session/${id}/export`);
    default:
      break;
  }

  const ideas = await listIdeas(id);
  const liveIdeas = ideas.filter((i) => !i.deleted).map(toClientIdea);

  return (
    <AppShell width="wide" footerSlot={<span>Personal use only</span>}>
      <IdeaList
        sessionId={id}
        initialSession={toClientSession(session)}
        initialIdeas={liveIdeas}
      />
    </AppShell>
  );
}
