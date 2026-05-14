// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
import { createSession, listSessions, toClientSession } from "@/lib/db";
import { newSessionSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessions = await listSessions();
    return Response.json({ sessions: sessions.map(toClientSession) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list sessions";
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

  const parsed = newSessionSchema.safeParse(body);
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
    const session = await createSession(parsed.data);
    return Response.json(
      { id: session._id.toHexString(), session: toClientSession(session) },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create session";
    return Response.json({ error: message }, { status: 500 });
  }
}
