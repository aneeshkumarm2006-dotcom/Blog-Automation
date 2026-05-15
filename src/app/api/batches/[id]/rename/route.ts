// runtime = "nodejs" — Edge runtime is unsupported (MongoDB driver requires Node).
import { ObjectId } from "mongodb";
import { renameSession, toClientSession } from "@/lib/db";
import { renameSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid batch id" }, { status: 400 });
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

  const session = await renameSession(id, parsed.data.name);
  if (!session) {
    return Response.json({ error: "Batch not found" }, { status: 404 });
  }
  return Response.json({ batch: toClientSession(session) });
}
