import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { AppShell } from "@/components/layout/AppShell";
import { listSessionsByProject, toClientSession } from "@/lib/db";
import { getProject, toClientProject } from "@/lib/projects";
import { ProjectDetail } from "./ProjectDetail";

export const metadata: Metadata = {
  title: "Project — Blog Automation",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    redirect("/projects");
  }

  const project = await getProject(id);
  if (!project) {
    redirect("/projects");
  }

  // If analysis hasn't completed yet, send to the analyzing screen.
  if (
    project.analysisStatus === "pending" ||
    project.analysisStatus === "analyzing"
  ) {
    redirect(`/projects/${id}/analyzing`);
  }

  const batches = await listSessionsByProject(id);

  return (
    <AppShell width="wide">
      <ProjectDetail
        projectId={id}
        initialProject={toClientProject(project)}
        initialBatches={batches.map(toClientSession)}
      />
    </AppShell>
  );
}
