// runtime = "nodejs" — Edge runtime is unsupported (MongoDB driver requires Node).
import { ObjectId } from "mongodb";
import {
  createSession,
  listSessionsByProject,
  toClientSession,
} from "@/lib/db";
import { getProject } from "@/lib/projects";
import { newBatchSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(
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

  const batches = await listSessionsByProject(id);
  return Response.json({ batches: batches.map(toClientSession) });
}

export async function POST(
  request: Request,
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

  if (project.analysisStatus !== "complete" || !project.siteAnalysis) {
    return Response.json(
      {
        error:
          "Project must have a completed site analysis before creating a batch",
      },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = newBatchSchema.safeParse(body);
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
    const session = await createSession({
      projectId: id,
      name: parsed.data.name,
      keywordPairs: parsed.data.keywordPairs,
      blogCount: parsed.data.blogCount,
      wordCount: parsed.data.wordCount,
    });
    return Response.json(
      {
        id: session._id.toHexString(),
        batch: toClientSession(session),
      },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create batch";
    return Response.json({ error: message }, { status: 500 });
  }
}
