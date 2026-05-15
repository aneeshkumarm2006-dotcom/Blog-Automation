import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { AppShell } from "@/components/layout/AppShell";
import {
  getSession,
  listBlogs,
  listIdeas,
  toClientBlog,
  toClientIdea,
  toClientSession,
} from "@/lib/db";
import { getProject, toClientProject } from "@/lib/projects";
import { ExportList } from "./ExportList";

export const metadata: Metadata = {
  title: "Export Blogs — Blog Automation",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ExportPage({ params }: PageProps) {
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

  // Bounce back to the appropriate stage if the batch isn't actually done.
  switch (session.status) {
    case "ideas_pending":
    case "failed":
      redirect(`/session/${id}/ideas`);
    case "ideas_approved":
    case "generating":
    case "humanizing":
      redirect(`/session/${id}/generating`);
    default:
      break;
  }

  const [blogs, ideas] = await Promise.all([listBlogs(id), listIdeas(id)]);

  return (
    <AppShell width="wide">
      <ExportList
        sessionId={id}
        session={toClientSession(session)}
        project={toClientProject(project)}
        blogs={blogs.map(toClientBlog)}
        ideas={ideas.filter((i) => !i.deleted).map(toClientIdea)}
      />
    </AppShell>
  );
}
