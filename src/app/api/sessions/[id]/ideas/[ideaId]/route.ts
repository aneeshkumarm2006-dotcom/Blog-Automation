// runtime = "nodejs" — Edge runtime is unsupported (MongoDB driver requires Node).
import { ObjectId } from "mongodb";
import {
  deleteIdea,
  getSession,
  listIdeas,
  patchIdea,
  toClientIdea,
} from "@/lib/db";
import { ideaPatchSchema } from "@/lib/schemas";

export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ id: string; ideaId: string }>;
}

export async function PATCH(
  request: Request,
  ctx: RouteCtx,
): Promise<Response> {
  const { id, ideaId } = await ctx.params;

  if (!ObjectId.isValid(id) || !ObjectId.isValid(ideaId)) {
    return Response.json(
      { error: "Invalid session or idea id" },
      { status: 400 },
    );
  }

  const session = await getSession(id);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ideaPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid patch body",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const existing = await listIdeas(id);
  const target = existing.find((i) => i._id.toHexString() === ideaId);
  if (!target || target.deleted) {
    return Response.json({ error: "Idea not found" }, { status: 404 });
  }

  const updated = await patchIdea(ideaId, parsed.data);
  if (!updated) {
    return Response.json({ error: "Idea not found" }, { status: 404 });
  }
  return Response.json({ idea: toClientIdea(updated) });
}

export async function DELETE(
  _request: Request,
  ctx: RouteCtx,
): Promise<Response> {
  const { id, ideaId } = await ctx.params;

  if (!ObjectId.isValid(id) || !ObjectId.isValid(ideaId)) {
    return Response.json(
      { error: "Invalid session or idea id" },
      { status: 400 },
    );
  }

  const session = await getSession(id);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  await deleteIdea(ideaId);
  return Response.json({ ok: true });
}
