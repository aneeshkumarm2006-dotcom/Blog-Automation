// ZeroGPT humanization client. Endpoint and shape verified empirically against
// https://api.zerogpt.com/api/transform/paraphrase (May 2026).
//
// The endpoint paraphrases one chunk at a time and is not markdown-aware:
//   - it strips newlines from the input,
//   - it returns the system message "no channel exists" when skipRealtime !== true,
//   - blank-line-separated chunks get treated as separate requests (each gets
//     its own "Sure! Please provide the text..." reply).
//
// So we chunk the markdown ourselves: frontmatter, headings, fenced code,
// lists, blockquotes, tables, and reference links pass through verbatim; only
// prose paragraphs are paraphrased.

const ENDPOINT = "https://api.zerogpt.com/api/transform/paraphrase";
const TIMEOUT_MS = 60_000;
const MIN_PARAPHRASE_LENGTH = 30;

export class HumanizationError extends Error {
  readonly code: string;
  constructor(message: string, code = "humanization_failed") {
    super(message);
    this.name = "HumanizationError";
    this.code = code;
  }
}

interface ZeroGptResponse {
  success?: boolean;
  code?: number;
  message?: string;
  data?: {
    message?: string;
    message_html?: string;
    lang?: string;
    conversation_id?: number;
    sentence_corrections?: unknown;
    code?: number;
  };
}

export interface HumanizeOptions {
  tone?: string;
  genSpeed?: "quick" | "slow";
}

export interface HumanizeResult {
  humanized: string;
  raw: unknown;
}

function getApiKey(): string {
  const key = process.env.ZEROGPT_API_KEY;
  if (!key) {
    throw new HumanizationError(
      "ZEROGPT_API_KEY is not set. Add it to .env.local before invoking humanization.",
      "missing_api_key",
    );
  }
  return key;
}

async function paraphraseChunk(
  input: string,
  apiKey: string,
  opts: HumanizeOptions,
): Promise<{ text: string; raw: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        ApiKey: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        string: input,
        wsId: "",
        skipRealtime: true,
        tone: opts.tone ?? "",
        gen_speed: opts.genSpeed ?? "quick",
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new HumanizationError(
        `ZeroGPT request timed out after ${TIMEOUT_MS}ms`,
        "timeout",
      );
    }
    throw new HumanizationError(
      err instanceof Error ? err.message : "ZeroGPT request failed",
      "network_error",
    );
  }
  clearTimeout(timer);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HumanizationError(
      `ZeroGPT returned ${res.status}: ${body.slice(0, 200)}`,
      `http_${res.status}`,
    );
  }

  const json = (await res.json()) as ZeroGptResponse;
  const out = json.data?.message;
  if (json.success === false || typeof out !== "string") {
    throw new HumanizationError(
      `ZeroGPT returned malformed response: ${JSON.stringify(json).slice(0, 200)}`,
      "malformed_response",
    );
  }
  return { text: out, raw: json };
}

// Split markdown into blocks while keeping fenced code and YAML frontmatter
// intact. Each returned entry is either a verbatim block (to pass through) or
// a prose block (to paraphrase).
type Block = { kind: "verbatim" | "prose"; text: string };

function classifyBlock(text: string): Block["kind"] {
  const trimmed = text.trim();
  if (!trimmed) return "verbatim";
  if (trimmed.length < MIN_PARAPHRASE_LENGTH) return "verbatim";
  const first = trimmed[0];
  if (first === "#") return "verbatim"; // headings
  if (first === ">") return "verbatim"; // blockquotes
  if (first === "|") return "verbatim"; // tables
  if (first === "!") return "verbatim"; // images
  if (first === "-" || first === "*" || first === "+") {
    if (/^[-*+]\s/.test(trimmed)) return "verbatim"; // bullet lists
    if (/^---\s*$/.test(trimmed)) return "verbatim"; // horizontal rule
  }
  if (/^\d+\.\s/.test(trimmed)) return "verbatim"; // ordered lists
  if (/^\[[^\]]+]:\s/.test(trimmed)) return "verbatim"; // ref-style link defs
  return "prose";
}

function splitMarkdown(input: string): Block[] {
  const blocks: Block[] = [];
  const lines = input.split("\n");
  let i = 0;

  // Strip leading YAML frontmatter as a single verbatim block.
  if (lines[0]?.trim() === "---") {
    let end = -1;
    for (let j = 1; j < lines.length; j++) {
      if (lines[j].trim() === "---") {
        end = j;
        break;
      }
    }
    if (end > 0) {
      blocks.push({
        kind: "verbatim",
        text: lines.slice(0, end + 1).join("\n"),
      });
      i = end + 1;
      // Eat one trailing blank line if present so reassembly doesn't double it.
      if (lines[i] === "") i++;
    }
  }

  const flushParagraph = (buf: string[]) => {
    if (buf.length === 0) return;
    const text = buf.join("\n");
    blocks.push({ kind: classifyBlock(text), text });
  };

  let paragraph: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block — gobble until the matching closing fence.
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      flushParagraph(paragraph);
      paragraph = [];
      const fence = fenceMatch[1];
      const codeLines: string[] = [line];
      i++;
      while (i < lines.length) {
        codeLines.push(lines[i]);
        if (lines[i].trim().startsWith(fence)) {
          i++;
          break;
        }
        i++;
      }
      blocks.push({ kind: "verbatim", text: codeLines.join("\n") });
      continue;
    }

    if (trimmed === "") {
      flushParagraph(paragraph);
      paragraph = [];
      i++;
      continue;
    }

    paragraph.push(line);
    i++;
  }
  flushParagraph(paragraph);
  return blocks;
}

function reassemble(outputs: string[]): string {
  return outputs.join("\n\n").replace(/\n{3,}/g, "\n\n");
}

export async function humanize(
  text: string,
  opts: HumanizeOptions = {},
): Promise<HumanizeResult> {
  const apiKey = getApiKey();
  const blocks = splitMarkdown(text);
  const outputs: string[] = new Array(blocks.length);
  const rawResponses: unknown[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.kind === "verbatim") {
      outputs[i] = block.text;
      continue;
    }
    try {
      const { text: paraphrased, raw } = await paraphraseChunk(
        block.text,
        apiKey,
        opts,
      );
      outputs[i] = paraphrased.trim() || block.text;
      rawResponses.push(raw);
    } catch (err) {
      // Per the spec, humanization is non-fatal — but a single chunk failure
      // should abort the whole pass so the caller can decide to fall back to
      // raw rather than ship a half-humanized doc.
      throw err instanceof HumanizationError
        ? err
        : new HumanizationError(
            err instanceof Error ? err.message : "Unknown error",
          );
    }
  }

  return { humanized: reassemble(outputs), raw: rawResponses };
}
