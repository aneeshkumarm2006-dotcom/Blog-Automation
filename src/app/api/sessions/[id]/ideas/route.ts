// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
import { ObjectId } from "mongodb";
import {
  bulkInsertIdeas,
  getSession,
  listIdeas,
  toClientIdea,
  updateSessionStatus,
  type NewIdea,
} from "@/lib/db";
import { getProject } from "@/lib/projects";
import { generateIdeasWithRetry } from "@/lib/ideas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
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

  const ideas = await listIdeas(id);
  return Response.json({
    ideas: ideas.filter((i) => !i.deleted).map(toClientIdea),
  });
}

export async function POST(
  _request: Request,
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
      { error: "Site analysis must complete before generating ideas" },
      { status: 409 },
    );
  }

  // Idempotency: if there are already non-deleted ideas, return them.
  const existing = await listIdeas(id);
  const liveExisting = existing.filter((i) => !i.deleted);
  if (liveExisting.length > 0) {
    return Response.json({
      ideas: liveExisting.map(toClientIdea),
    });
  }

  try {
    const generated = await generateIdeasWithRetry({
      siteAnalysis: project.siteAnalysis,
      keywordPairs: session.keywordPairs,
      blogCount: session.blogCount,
      wordCount: session.wordCount,
    });

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

    // Make sure the batch sits at `ideas_pending` while the user reviews.
    if (
      session.status !== "ideas_pending" &&
      session.status !== "ideas_approved"
    ) {
      await updateSessionStatus(id, "ideas_pending");
    }

    return Response.json({ ideas: inserted.map(toClientIdea) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Idea generation failed";
    await updateSessionStatus(id, "failed", {
      failureReason: `Idea generation failed: ${message}`,
    });
    return Response.json({ error: message }, { status: 502 });
  }
}
