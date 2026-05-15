// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
import {
  createProject,
  listProjects,
  toClientProject,
} from "@/lib/projects";
import { newProjectSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const docs = await listProjects();
    return Response.json({ projects: docs.map(toClientProject) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list projects";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = newProjectSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
    return Response.json(
      { error: "Validation failed", issues },
      { status: 400 },
    );
  }

  try {
    const project = await createProject(parsed.data);
    return Response.json(
      {
        id: project._id.toHexString(),
        project: toClientProject(project),
      },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create project";
    return Response.json({ error: message }, { status: 500 });
  }
}
