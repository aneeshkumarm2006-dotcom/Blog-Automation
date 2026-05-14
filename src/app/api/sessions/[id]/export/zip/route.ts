// runtime = "nodejs" — Edge runtime is unsupported (MongoDB driver + archiver require Node).
import { Readable } from "node:stream";
import { ObjectId } from "mongodb";
import archiver from "archiver";
import { getSession, listBlogs, listIdeas } from "@/lib/db";
import { slugifyBlog } from "@/lib/slugify";

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

  const [blogs, ideas] = await Promise.all([listBlogs(id), listIdeas(id)]);
  const ideaById = new Map(ideas.map((i) => [i._id.toHexString(), i]));

  const entries = blogs
    .map((blog) => {
      const content = blog.humanizedContent ?? blog.rawContent;
      if (!content) return null;
      const idea = ideaById.get(blog.ideaId.toHexString());
      const slug = slugifyBlog(idea?.title, blog._id.toHexString());
      return { slug, content };
    })
    .filter((e): e is { slug: string; content: string } => e !== null);

  if (entries.length === 0) {
    return Response.json(
      { error: "No exportable blogs in this session" },
      { status: 409 },
    );
  }

  // Disambiguate accidental slug collisions deterministically.
  const seen = new Map<string, number>();
  for (const entry of entries) {
    const count = seen.get(entry.slug) ?? 0;
    seen.set(entry.slug, count + 1);
    if (count > 0) {
      entry.slug = `${entry.slug}-${count + 1}`;
    }
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  for (const entry of entries) {
    archive.append(entry.content, { name: `${entry.slug}.md` });
  }
  // finalize() is async but the result we care about is the readable side of
  // the stream — we surface errors via the stream itself.
  archive.finalize().catch((err) => {
    archive.emit("error", err);
  });

  const webStream = Readable.toWeb(archive) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="blogforge-${id}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
