// runtime = "nodejs" — Edge runtime is unsupported (MongoDB driver requires Node).
import { ObjectId } from "mongodb";
import {
  deleteIdeasBySessions,
  deleteBlogsBySessions,
  deleteSessionsByProject,
} from "@/lib/db";
import {
  deleteProject,
  getProject,
  renameProject,
  toClientProject,
} from "@/lib/projects";
import { renameSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid project id" }, { status: 400 });
  }

  try {
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
    return Response.json({ project: toClientProject(project) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load project";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid project id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const project = await renameProject(id, parsed.data.name);
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  return Response.json({ project: toClientProject(project) });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid project id" }, { status: 400 });
  }

  const project = await getProject(id);
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Cascade: collect session ids, then delete blogs + ideas + sessions + project.
  const sessionIds = await deleteSessionsByProject(id);
  await Promise.all([
    deleteBlogsBySessions(sessionIds),
    deleteIdeasBySessions(sessionIds),
  ]);
  await deleteProject(id);

  return Response.json({ ok: true });
}
