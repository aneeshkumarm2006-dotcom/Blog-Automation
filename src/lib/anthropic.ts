// Memoized Anthropic SDK client. Edge runtime is unsupported — Anthropic SDK
// + MongoDB driver require Node. Always read ANTHROPIC_API_KEY at first use;
// throw with a clear message if missing so the failure points at the config,
// not at a downstream call shape.

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local before invoking AI routes.",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export const ANTHROPIC_MODEL = "claude-sonnet-4-6" as const;
