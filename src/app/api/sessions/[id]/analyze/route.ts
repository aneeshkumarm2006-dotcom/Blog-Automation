// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
import { ObjectId } from "mongodb";
import {
  getSession,
  toClientSession,
  updateSessionStatus,
} from "@/lib/db";
import { ANTHROPIC_MODEL, getAnthropicClient } from "@/lib/anthropic";
import { SITE_ANALYSIS_SYSTEM_PROMPT } from "@/lib/prompts/site-analysis";
import { siteAnalysisSchema, type SiteAnalysisData } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

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

function tryParseJson(raw: string): unknown {
  if (!raw) return undefined;

  // Strip ```json ... ``` fences, with or without language tag.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      // fall through to brace-extraction
    }
  }

  // Fallback: grab the first {...} block.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function callAnthropic(websiteUrl: string): Promise<SiteAnalysisData> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: SITE_ANALYSIS_SYSTEM_PROMPT,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Analyze this website: ${websiteUrl}`,
      },
    ],
  });

  const text = extractText(response as MessageLike);
  const parsed = tryParseJson(text);
  return siteAnalysisSchema.parse(parsed);
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

  // Idempotency: if we're already past the analyzing step, return current state.
  if (
    session.status !== "created" &&
    session.status !== "analyzing" &&
    session.status !== "failed"
  ) {
    return Response.json({ session: toClientSession(session) });
  }

  await updateSessionStatus(id, "analyzing");

  let analysis: SiteAnalysisData | undefined;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      analysis = await callAnthropic(session.websiteUrl);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (!analysis) {
    const reason = `Site analysis failed: ${lastError ?? "unknown error"}`;
    await updateSessionStatus(id, "failed", { failureReason: reason });
    return Response.json({ error: reason }, { status: 502 });
  }

  await updateSessionStatus(id, "ideas_pending", {
    siteAnalysis: analysis,
  });

  const fresh = await getSession(id);
  return Response.json({
    session: fresh ? toClientSession(fresh) : null,
  });
}
