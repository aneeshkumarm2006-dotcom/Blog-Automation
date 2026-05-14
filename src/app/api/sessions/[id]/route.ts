// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
import { ObjectId } from "mongodb";
import { getSession, toClientSession } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid session id" }, { status: 400 });
  }

  try {
    const session = await getSession(id);
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }
    return Response.json({ session: toClientSession(session) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load session";
    return Response.json({ error: message }, { status: 500 });
  }
}
