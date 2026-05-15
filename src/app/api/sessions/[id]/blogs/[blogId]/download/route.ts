// runtime = "nodejs" — Edge runtime is unsupported (MongoDB driver requires Node).
import { ObjectId } from "mongodb";
import { getBlog, getSession, listIdeas } from "@/lib/db";
import { slugifyBlog } from "@/lib/slugify";

export const runtime = "nodejs";

type Variant = "humanized" | "raw";

function pickVariant(url: URL): Variant {
  const requested = url.searchParams.get("variant");
  return requested === "raw" ? "raw" : "humanized";
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string; blogId: string }> },
): Promise<Response> {
  const { id, blogId } = await ctx.params;

  if (!ObjectId.isValid(id) || !ObjectId.isValid(blogId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const session = await getSession(id);
  if (!session) {
    return Response.json({ error: "Batch not found" }, { status: 404 });
  }

  const blog = await getBlog(blogId);
  if (!blog || !blog.sessionId.equals(session._id)) {
    return Response.json({ error: "Blog not found" }, { status: 404 });
  }

  const requested = pickVariant(new URL(request.url));
  // Prefer the requested variant; fall back to whichever is available so the
  // download never 404s on a blog the export UI is willing to show.
  const content =
    requested === "humanized"
      ? (blog.humanizedContent ?? blog.rawContent)
      : (blog.rawContent ?? blog.humanizedContent);

  if (!content) {
    return Response.json(
      { error: "Blog content unavailable" },
      { status: 409 },
    );
  }

  const ideas = await listIdeas(id);
  const idea = ideas.find((i) => i._id.equals(blog.ideaId));
  // Prefer the user-set blog.name (rename UI); fall back to the idea title.
  const slug = slugifyBlog(blog.name ?? idea?.title, blog._id.toHexString());

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
