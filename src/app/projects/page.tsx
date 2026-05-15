import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { listProjects, toClientProject } from "@/lib/projects";
import { ProjectList } from "./ProjectList";

export const metadata: Metadata = {
  title: "Projects — Blog Automation",
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();
  return (
    <AppShell width="wide">
      <ProjectList projects={projects.map(toClientProject)} />
    </AppShell>
  );
}
