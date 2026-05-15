import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { AppShell } from "@/components/layout/AppShell";
import { getProject, toClientProject } from "@/lib/projects";
import { ProjectAnalyzingClient } from "./ProjectAnalyzingClient";

export const metadata: Metadata = {
  title: "Analyzing Site... — Blog Automation",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectAnalyzingPage({ params }: PageProps) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    redirect("/projects");
  }

  const project = await getProject(id);
  if (!project) {
    redirect("/projects");
  }

  // If analysis is already complete, send the user straight to the project page.
  if (project.analysisStatus === "complete") {
    redirect(`/projects/${id}`);
  }

  return (
    <AppShell width="wide">
      <ProjectAnalyzingClient
        projectId={id}
        initialProject={toClientProject(project)}
      />
    </AppShell>
  );
}
