// Idea-generation helpers shared by `/api/sessions/[id]/ideas` (initial batch)
// and `/api/sessions/[id]/ideas/regenerate` (replace a subset of slots).
//
// Stage 7 of TODO.md: enforces `ideas.length === blogCount`, every
// {keyword, backlink} pair is used exactly once and only comes from the input
// pairs, retries once on parse/validation failure.

import { ANTHROPIC_MODEL, getAnthropicClient } from "@/lib/anthropic";
import { IDEA_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts/idea-generation";
import { ideasResponseSchema, type IdeaItem } from "@/lib/schemas";
import type { KeywordPair, SiteAnalysis } from "@/types";

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

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      // fall through
    }
  }

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

export interface GenerateIdeasInput {
  siteAnalysis: SiteAnalysis | undefined;
  keywordPairs: KeywordPair[];
  blogCount: number;
  wordCount: number;
}

async function callAnthropic(
  input: GenerateIdeasInput,
): Promise<IdeaItem[]> {
  const client = getAnthropicClient();
  const userPayload = {
    siteAnalysis: input.siteAnalysis ?? null,
    keywordPairs: input.keywordPairs,
    blogCount: input.blogCount,
    wordCount: input.wordCount,
  };

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: IDEA_GENERATION_SYSTEM_PROMPT,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: [
      {
        role: "user",
        content:
          "Generate blog ideas for the following session. Return strict JSON.\n\n" +
          JSON.stringify(userPayload, null, 2),
      },
    ],
  });

  const text = extractText(response as MessageLike);
  const parsed = tryParseJson(text);
  const validated = ideasResponseSchema.parse(parsed);
  return enforceConstraints(validated.ideas, input);
}

function enforceConstraints(
  ideas: IdeaItem[],
  input: GenerateIdeasInput,
): IdeaItem[] {
  if (ideas.length !== input.blogCount) {
    throw new Error(
      `Idea count mismatch: expected ${input.blogCount}, got ${ideas.length}`,
    );
  }

  const remaining = new Map<string, KeywordPair>();
  for (const pair of input.keywordPairs) {
    remaining.set(pairKey(pair.keyword, pair.backlink), pair);
  }

  for (const idea of ideas) {
    const key = pairKey(idea.assignedKeyword, idea.assignedBacklink);
    const match = remaining.get(key);
    if (!match) {
      throw new Error(
        `Idea references a keyword/backlink pair not in the input: ` +
          `${idea.assignedKeyword} → ${idea.assignedBacklink}`,
      );
    }
    remaining.delete(key);
  }

  if (remaining.size > 0) {
    const unused = Array.from(remaining.values())
      .map((p) => `${p.keyword} → ${p.backlink}`)
      .join("; ");
    throw new Error(`Keyword pairs not used by any idea: ${unused}`);
  }

  return ideas;
}

function pairKey(keyword: string, backlink: string): string {
  return `${keyword.trim().toLowerCase()}${backlink.trim()}`;
}

export async function generateIdeasWithRetry(
  input: GenerateIdeasInput,
): Promise<IdeaItem[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await callAnthropic(input);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Idea generation failed");
}
