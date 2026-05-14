// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
import { ObjectId } from "mongodb";
import {
  getSession,
  listBlogs,
  listIdeas,
  toClientSession,
  updateSessionStatus,
  upsertBlog,
} from "@/lib/db";
import { ANTHROPIC_MODEL, getAnthropicClient } from "@/lib/anthropic";
import { BLOG_WRITER_SYSTEM_PROMPT } from "@/lib/prompts/blog-writer";
import { humanize, HumanizationError } from "@/lib/zerogpt";
import type {
  Idea,
  Session,
  SiteAnalysis,
} from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface MessageLike {
  content?: Array<{ type: string; text?: string }>;
}

function extractText(message: MessageLike): string {
  const blocks = message.content ?? [];
  const texts = blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string);
  return texts.join("\n").trim();
}

function stripCodeFence(raw: string): string {
  const fence = raw.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```\s*$/i);
  return fence ? fence[1].trim() : raw.trim();
}

function countWords(text: string): number {
  const stripped = text
    .replace(/^---[\s\S]*?---\n?/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_`~\-]/g, " ");
  const tokens = stripped
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => /\w/.test(t));
  return tokens.length;
}

function condenseSiteContext(analysis: SiteAnalysis | undefined): string {
  if (!analysis) return "(no site analysis available)";
  const niche = analysis.niche ?? "unknown niche";
  const audience = analysis.audience?.primary ?? "unspecified audience";
  const role = analysis.audience?.role_seniority ?? "";
  const expertise = analysis.audience?.expertise_level ?? "";
  const tone = analysis.tone?.summary ?? "unspecified tone";
  const samples = analysis.tone?.sample_phrases?.filter(Boolean).slice(0, 2) ?? [];
  const gaps = analysis.content_gaps?.filter(Boolean).slice(0, 5) ?? [];
  const hooks =
    analysis.differentiation_hooks?.filter(Boolean).slice(0, 5) ?? [];

  const lines: string[] = [];
  lines.push(`Niche: ${niche}`);
  lines.push(
    `Audience: ${audience}${role ? ` (${role})` : ""}${
      expertise ? ` — ${expertise}` : ""
    }`,
  );
  lines.push(`Tone: ${tone}`);
  if (samples.length) {
    lines.push(`Sample phrases: ${samples.map((s) => `"${s}"`).join(" / ")}`);
  }
  if (gaps.length) {
    lines.push(`Content gaps: ${gaps.join("; ")}`);
  }
  if (hooks.length) {
    lines.push(`Differentiation hooks: ${hooks.join("; ")}`);
  }
  return lines.join("\n");
}

function buildUserPrompt(idea: Idea, session: Session): string {
  const siteContext = condenseSiteContext(session.siteAnalysis);
  return [
    `Write a complete Markdown blog post for the inputs below.`,
    ``,
    `title: ${idea.title}`,
    `angle: ${idea.angle}`,
    `wordCount: ${idea.wordCountTarget}`,
    `keyword: ${idea.assignedKeyword}`,
    `backlink: ${idea.assignedBacklink}`,
    ``,
    `siteContext:`,
    siteContext,
    ``,
    `Return only the Markdown document. Start with the YAML frontmatter and end with the final line of the Sources section.`,
  ].join("\n");
}

async function generateOneBlog(idea: Idea, session: Session): Promise<string> {
  const client = getAnthropicClient();
  const stream = client.messages.stream({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    system: BLOG_WRITER_SYSTEM_PROMPT,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: buildUserPrompt(idea, session),
      },
    ],
  });

  const final = await stream.finalMessage();
  const text = extractText(final as MessageLike);
  const stripped = stripCodeFence(text);
  if (!stripped) {
    throw new Error("Blog writer returned empty content");
  }
  return stripped;
}

async function runOneIdea(
  idea: Idea,
  session: Session,
  opts: { humanizationEnabled: boolean },
): Promise<void> {
  const sessionId = session._id;

  await upsertBlog({
    sessionId,
    ideaId: idea._id,
    status: "writing",
  });

  let rawContent: string | undefined;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      rawContent = await generateOneBlog(idea, session);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!rawContent) {
    await upsertBlog({
      sessionId,
      ideaId: idea._id,
      status: "failed",
      failureReason: lastError ?? "Unknown error",
    });
    return;
  }

  const wordCount = countWords(rawContent);
  await upsertBlog({
    sessionId,
    ideaId: idea._id,
    status: "raw",
    rawContent,
    wordCount,
    generatedAt: new Date(),
  });

  // Humanization pass (Stage 9). Non-fatal: any failure falls back to the raw
  // markdown with humanizationFailed=true so the export step still has a
  // usable artifact.
  if (!opts.humanizationEnabled) {
    await upsertBlog({
      sessionId,
      ideaId: idea._id,
      status: "humanized",
      humanizationFailed: true,
    });
    return;
  }

  await upsertBlog({
    sessionId,
    ideaId: idea._id,
    status: "humanizing",
  });

  try {
    const { humanized } = await humanize(rawContent);
    await upsertBlog({
      sessionId,
      ideaId: idea._id,
      status: "humanized",
      humanizedContent: humanized,
      humanizationFailed: false,
    });
  } catch (err) {
    const reason =
      err instanceof HumanizationError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "Unknown humanization error";
    console.warn(
      `[humanize] blog ${idea._id.toHexString()} fell back to raw: ${reason}`,
    );
    await upsertBlog({
      sessionId,
      ideaId: idea._id,
      status: "humanized",
      humanizationFailed: true,
    });
  }
}

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

  // Idempotency: only kick off when the session is sitting at ideas_approved
  // or is recovering from a prior failure. If it's already running or done,
  // return current state and let the client keep polling /blogs.
  if (
    session.status !== "ideas_approved" &&
    session.status !== "generating" &&
    session.status !== "humanizing" &&
    session.status !== "failed"
  ) {
    return Response.json(
      {
        error: `Session is not ready to generate (status="${session.status}")`,
      },
      { status: 409 },
    );
  }

  // If a generate run is already in flight on another invocation, don't start
  // a second one — just acknowledge.
  if (session.status === "generating" || session.status === "humanizing") {
    const fresh = await getSession(id);
    return Response.json({
      session: fresh ? toClientSession(fresh) : null,
      alreadyRunning: true,
    });
  }

  const liveIdeas = (await listIdeas(id)).filter((idea) => !idea.deleted);
  if (liveIdeas.length === 0) {
    return Response.json(
      { error: "No ideas to generate" },
      { status: 400 },
    );
  }

  const humanizationEnabled = Boolean(process.env.ZEROGPT_API_KEY);
  if (!humanizationEnabled) {
    // Soft warning: missing key is not a session failure. Per-blog
    // amber badges on the export screen will tell the user humanization
    // was skipped; the server log captures the config issue for ops.
    console.warn(
      "[generate] ZEROGPT_API_KEY is not set — proceeding with humanization disabled; all blogs will be flagged humanizationFailed.",
    );
  }

  await updateSessionStatus(id, "generating");

  // Pre-seed queued blog docs so the polling UI can render the full list of
  // cards immediately (rather than appearing card-by-card).
  for (const idea of liveIdeas) {
    const existing = await listBlogs(id);
    const already = existing.find(
      (b) => b.ideaId.toHexString() === idea._id.toHexString(),
    );
    if (!already) {
      await upsertBlog({
        sessionId: session._id,
        ideaId: idea._id,
        status: "queued",
      });
    }
  }

  // Run the loop serially. Per PDR, no queue in v1 — one blog at a time.
  for (const idea of liveIdeas) {
    try {
      await runOneIdea(idea, session, { humanizationEnabled });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await upsertBlog({
        sessionId: session._id,
        ideaId: idea._id,
        status: "failed",
        failureReason: reason,
      });
      // Continue with the next idea — a single blog failure must not abort
      // the whole batch.
    }
  }

  await updateSessionStatus(id, "done");

  const fresh = await getSession(id);
  return Response.json({
    session: fresh ? toClientSession(fresh) : null,
  });
}
