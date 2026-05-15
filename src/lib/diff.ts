// Dependency-free diff used by the Export screen's raw-vs-humanized view.
//
// Two passes:
//   1. Line-level LCS to align the two documents (cheap — blog posts are a
//      few hundred lines at most).
//   2. Word-level LCS *only* within paired changed lines, so the side-by-side
//      view can highlight exactly which words ZeroGPT rewrote.
//
// Kept pure and free of React so it can be unit-tested in isolation
// (vitest target per updates.md §6).

export type SegmentType = "equal" | "removed" | "added";

export interface Segment {
  type: SegmentType;
  text: string;
}

export type RowType = "equal" | "changed" | "removed" | "added";

export interface DiffRow {
  type: RowType;
  // Word segments for the left (raw) column. `undefined` => no left line.
  left?: Segment[];
  // Word segments for the right (humanized) column.
  right?: Segment[];
}

export interface DiffResult {
  rows: DiffRow[];
  changedLines: number;
  addedLines: number;
  removedLines: number;
}

type Op = "equal" | "delete" | "insert";

interface LineOp {
  op: Op;
  a?: string; // line from the left/raw document
  b?: string; // line from the right/humanized document
}

/**
 * Classic LCS backtrack over two sequences. Equality is provided by the
 * caller so this works for both lines (string ===) and word tokens.
 */
function lcsOps<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): LineOp[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:] and b[j:].
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: LineOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      ops.push({ op: "equal", a: String(a[i]), b: String(b[j]) });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: "delete", a: String(a[i]) });
      i++;
    } else {
      ops.push({ op: "insert", b: String(b[j]) });
      j++;
    }
  }
  while (i < n) ops.push({ op: "delete", a: String(a[i++]) });
  while (j < m) ops.push({ op: "insert", b: String(b[j++]) });
  return ops;
}

// Split into words while keeping whitespace as its own tokens so spacing
// (and therefore the rendered line) is preserved exactly.
function tokenizeWords(line: string): string[] {
  return line.split(/(\s+)/).filter((t) => t.length > 0);
}

function wordSegments(
  rawLine: string,
  humanizedLine: string,
): { left: Segment[]; right: Segment[] } {
  const aTokens = tokenizeWords(rawLine);
  const bTokens = tokenizeWords(humanizedLine);
  const ops = lcsOps(aTokens, bTokens, (x, y) => x === y);

  const left: Segment[] = [];
  const right: Segment[] = [];
  for (const op of ops) {
    if (op.op === "equal") {
      left.push({ type: "equal", text: op.a ?? "" });
      right.push({ type: "equal", text: op.b ?? "" });
    } else if (op.op === "delete") {
      left.push({ type: "removed", text: op.a ?? "" });
    } else {
      right.push({ type: "added", text: op.b ?? "" });
    }
  }
  return { left, right };
}

function plain(line: string): Segment[] {
  return [{ type: "equal", text: line }];
}

/**
 * Diff two markdown documents into aligned side-by-side rows.
 *
 * A run of deletions immediately followed by insertions is treated as a
 * block of edits: deletions and insertions are paired up by position so each
 * "changed" row gets a left + right line with word-level highlighting. Any
 * leftover unpaired lines render as one-sided added/removed rows.
 */
export function diffDocuments(raw: string, humanized: string): DiffResult {
  const aLines = raw.replace(/\r\n/g, "\n").split("\n");
  const bLines = humanized.replace(/\r\n/g, "\n").split("\n");
  const ops = lcsOps(aLines, bLines, (x, y) => x === y);

  const rows: DiffRow[] = [];
  let changedLines = 0;
  let addedLines = 0;
  let removedLines = 0;

  let k = 0;
  while (k < ops.length) {
    const op = ops[k];

    if (op.op === "equal") {
      rows.push({ type: "equal", left: plain(op.a ?? ""), right: plain(op.b ?? "") });
      k++;
      continue;
    }

    // Collect the contiguous block of non-equal ops.
    const deletes: string[] = [];
    const inserts: string[] = [];
    while (k < ops.length && ops[k].op !== "equal") {
      if (ops[k].op === "delete") deletes.push(ops[k].a ?? "");
      else inserts.push(ops[k].b ?? "");
      k++;
    }

    const paired = Math.min(deletes.length, inserts.length);
    for (let p = 0; p < paired; p++) {
      const { left, right } = wordSegments(deletes[p], inserts[p]);
      rows.push({ type: "changed", left, right });
      changedLines++;
    }
    for (let p = paired; p < deletes.length; p++) {
      rows.push({ type: "removed", left: plain(deletes[p]) });
      removedLines++;
    }
    for (let p = paired; p < inserts.length; p++) {
      rows.push({ type: "added", right: plain(inserts[p]) });
      addedLines++;
    }
  }

  return { rows, changedLines, addedLines, removedLines };
}
