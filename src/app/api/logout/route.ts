// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
// Stub: real implementation lands in Stage 3 (password gate + auth middleware).
export const runtime = "nodejs";

export async function POST() {
  return new Response("Not implemented", { status: 501 });
}
