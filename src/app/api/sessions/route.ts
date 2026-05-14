// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
// Stub: real implementation lands in Stage 5 (POST create session, GET list sessions).
export const runtime = "nodejs";

export async function GET() {
  return new Response("Not implemented", { status: 501 });
}

export async function POST() {
  return new Response("Not implemented", { status: 501 });
}
