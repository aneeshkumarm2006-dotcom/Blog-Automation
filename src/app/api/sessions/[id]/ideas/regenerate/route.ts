// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
import { ObjectId } from "mongodb";
import {
  bulkInsertIdeas,
  deleteIdea,
  getSession,
  listIdeas,
  toClientIdea,
  type NewIdea,
} from "@/lib/db";
import { getProject } from "@/lib/projects";
import { generateIdeasWithRetry } from "@/lib/ideas";
import { regenerateIdeasSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const session = await getSession(id);
  if (!session) {
    return Response.json({ error: "Batch not found" }, { status: 404 });
  }

  const project = await getProject(session.projectId);
  if (!project) {
    return Response.json({ error: "Parent project not found" }, { status: 404 });
  }

  if (!project.siteAnalysis) {
    return Response.json(
      { error: "Site analysis must complete before regenerating ideas" },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = regenerateIdeasSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const targetIds = new Set<string>(parsed.data.ideaIds);
  for (const tid of targetIds) {
    if (!ObjectId.isValid(tid)) {
      return Response.json(
        { error: `Invalid idea id: ${tid}` },
        { status: 400 },
      );
    }
  }

  const all = await listIdeas(id);
  const targets = all.filter(
    (i) => targetIds.has(i._id.toHexString()) && !i.deleted,
  );

  if (targets.length === 0) {
    return Response.json(
      { error: "No matching ideas to regenerate" },
      { status: 400 },
    );
  }

  // Keyword pairs are shared across the whole batch, so regeneration only
  // needs to produce `targets.length` fresh ideas using the session's pairs.
  try {
    const generated = await generateIdeasWithRetry({
      siteAnalysis: project.siteAnalysis,
      keywordPairs: session.keywordPairs,
      blogCount: targets.length,
      wordCount: session.wordCount,
    });

    // Soft-delete the targeted ideas (they're being replaced).
    await Promise.all(
      targets.map((t) => deleteIdea(t._id.toHexString())),
    );

    const docs: NewIdea[] = generated.map((idea) => ({
      title: idea.title,
      angle: idea.angle,
      searchIntent: idea.searchIntent,
      wordCountTarget: idea.wordCountTarget,
      primaryGapAddressed: idea.primaryGapAddressed,
      uniqueValueHook: idea.uniqueValueHook,
      approved: false,
      edited: false,
      deleted: false,
    }));

    const inserted = await bulkInsertIdeas(id, docs);
    return Response.json({ ideas: inserted.map(toClientIdea) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Idea regeneration failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
