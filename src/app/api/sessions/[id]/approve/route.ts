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

  // Keyword pairs are shared across the whole batch (every blog embeds all of
  // them), so there is no per-idea pair to validate before approval.
  await updateSessionStatus(id, "ideas_approved");
  const fresh = await getSession(id);
  return Response.json({
    session: fresh ? toClientSession(fresh) : null,
  });
}
