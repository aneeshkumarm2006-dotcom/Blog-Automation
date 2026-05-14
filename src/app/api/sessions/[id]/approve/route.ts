// runtime = "nodejs" — Edge runtime is unsupported (MongoDB driver requires Node).
import { ObjectId } from "mongodb";
import {
  getSession,
  listIdeas,
  toClientSession,
  updateSessionStatus,
} from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid session id" }, { status: 400 });
  }

  const session = await getSession(id);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const live = (await listIdeas(id)).filter((i) => !i.deleted);
  if (live.length === 0) {
    return Response.json(
      { error: "Cannot approve a session with no ideas" },
      { status: 400 },
    );
  }

  // Every live idea must reference a real keyword/backlink pair from the
  // session — guards against UI drift if a pair was edited away.
  for (const idea of live) {
    const ok = session.keywordPairs.some(
      (p) =>
        p.keyword === idea.assignedKeyword &&
        p.backlink === idea.assignedBacklink,
    );
    if (!ok) {
      return Response.json(
        {
          error:
            `Idea "${idea.title}" references a keyword/backlink pair that ` +
            `is no longer in the session.`,
        },
        { status: 400 },
      );
    }
  }

  await updateSessionStatus(id, "ideas_approved");
  const fresh = await getSession(id);
  return Response.json({
    session: fresh ? toClientSession(fresh) : null,
  });
}
