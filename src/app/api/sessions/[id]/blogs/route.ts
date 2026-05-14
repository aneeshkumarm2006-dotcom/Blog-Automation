// runtime = "nodejs" — Edge runtime is unsupported (MongoDB driver requires Node).
import { ObjectId } from "mongodb";
import {
  getSession,
  listBlogs,
  listIdeas,
  toClientBlog,
  toClientIdea,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
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

  const [blogs, ideas] = await Promise.all([
    listBlogs(id),
    listIdeas(id),
  ]);

  return Response.json({
    blogs: blogs.map(toClientBlog),
    ideas: ideas.filter((i) => !i.deleted).map(toClientIdea),
  });
}
