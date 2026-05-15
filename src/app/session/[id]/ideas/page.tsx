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
import { getProject, toClientProject } from "@/lib/projects";
import { IdeaList } from "./IdeaList";

export const metadata: Metadata = {
  title: "Approve Ideas — Blog Automation",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApproveIdeasPage({ params }: PageProps) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    redirect("/projects");
  }

  const session = await getSession(id);
  if (!session) {
    redirect("/projects");
  }

  const project = await getProject(session.projectId);
  if (!project) {
    redirect("/projects");
  }

  // Route by batch status: forward to generating/export if past approval.
  switch (session.status) {
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
    <AppShell width="wide">
      <IdeaList
        sessionId={id}
        initialSession={toClientSession(session)}
        initialProject={toClientProject(project)}
        initialIdeas={liveIdeas}
      />
    </AppShell>
  );
}
