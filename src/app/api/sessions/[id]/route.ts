// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
// Stub: real implementation lands in Stage 6 (GET serialized session for the analyzing-page poller).
export const runtime = "nodejs";

export async function GET() {
  return new Response("Not implemented", { status: 501 });
}
