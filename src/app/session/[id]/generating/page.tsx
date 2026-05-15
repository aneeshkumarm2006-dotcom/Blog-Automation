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
import { BlogProgress } from "./BlogProgress";

export const metadata: Metadata = {
  title: "Generating Blogs — Blog Automation",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GeneratingPage({ params }: PageProps) {
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

  // Short-circuit if the batch has moved off this stage in either direction.
  switch (session.status) {
    case "ideas_pending":
      redirect(`/session/${id}/ideas`);
    case "done":
      redirect(`/session/${id}/export`);
    default:
      break;
  }

  const [blogs, ideas] = await Promise.all([listBlogs(id), listIdeas(id)]);

  return (
    <AppShell width="wide">
      <BlogProgress
        sessionId={id}
        initialSession={toClientSession(session)}
        initialProject={toClientProject(project)}
        initialBlogs={blogs.map(toClientBlog)}
        initialIdeas={ideas.filter((i) => !i.deleted).map(toClientIdea)}
      />
    </AppShell>
  );
}
