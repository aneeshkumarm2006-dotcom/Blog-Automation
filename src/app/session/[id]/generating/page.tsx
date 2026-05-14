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
import { BlogProgress } from "./BlogProgress";

export const metadata: Metadata = {
  title: "Generating Blogs — BlogForge",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GeneratingPage({ params }: PageProps) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    redirect("/history");
  }

  const session = await getSession(id);
  if (!session) {
    redirect("/history");
  }

  // Short-circuit if the session has moved off this stage in either direction.
  switch (session.status) {
    case "created":
    case "analyzing":
      redirect(`/session/${id}/analyzing`);
    case "ideas_pending":
      redirect(`/session/${id}/ideas`);
    case "done":
      redirect(`/session/${id}/export`);
    default:
      break;
  }

  const [blogs, ideas] = await Promise.all([listBlogs(id), listIdeas(id)]);

  return (
    <AppShell width="wide" footerSlot={<span>Personal use only</span>}>
      <BlogProgress
        sessionId={id}
        initialSession={toClientSession(session)}
        initialBlogs={blogs.map(toClientBlog)}
        initialIdeas={ideas.filter((i) => !i.deleted).map(toClientIdea)}
      />
    </AppShell>
  );
}
