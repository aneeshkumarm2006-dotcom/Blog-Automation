// Idea-generation helpers shared by `/api/sessions/[id]/ideas` (initial batch)
// and `/api/sessions/[id]/ideas/regenerate` (replace a subset of slots).
//
// Enforces `ideas.length === blogCount`. Keyword pairs are shared across the
// whole batch (every blog embeds all of them), so there is no per-idea pair
// assignment. Retries once on parse/validation failure.

import type Anthropic from "@anthropic-ai/sdk";
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

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Generate blog ideas for the following session. Return strict JSON.\n\n" +
        JSON.stringify(userPayload, null, 2),
    },
  ];

  // `web_search` runs server-side; a long-running search can return
  // `stop_reason: "pause_turn"` with no final text. The single-shot
  // create() never resumed that turn, so the JSON we parse was empty/
  // truncated and Zod blew up with "expected object, received undefined".
  // Feed the paused assistant turn back and continue until the model
  // actually finishes (or we hit a hard cap).
  let response: Anthropic.Message | undefined;
  for (let turn = 0; turn < 5; turn++) {
    response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      // Bumped from 4000: adaptive thinking + web-search query blocks
      // were eating the budget before the 5-idea JSON could be emitted,
      // truncating the response (stop_reason: "max_tokens").
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: IDEA_GENERATION_SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages,
    });

    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }

  if (!response) {
    throw new Error("Idea generation produced no response from the model");
  }

  const text = extractText(response as MessageLike);
  const parsed = tryParseJson(text);
  if (parsed === undefined) {
    const snippet = text.slice(0, 200).replace(/\s+/g, " ").trim();
    throw new Error(
      `Idea generation returned no parseable JSON ` +
        `(stop_reason=${response.stop_reason ?? "unknown"}` +
        `${snippet ? `, text="${snippet}…"` : ", empty text output"}). ` +
        `The model likely ran out of output tokens mid-response.`,
    );
  }
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

  // Keyword pairs are shared across the whole batch (every blog embeds all of
  // them), so there is no per-idea pair assignment to validate here.
  return ideas;
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
