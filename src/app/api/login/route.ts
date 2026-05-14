// runtime = "nodejs" — Edge runtime is unsupported (Anthropic SDK + MongoDB driver require Node).
import { serialize } from "cookie";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  constantTimeEqualString,
  signSession,
} from "@/lib/auth";

export const runtime = "nodejs";

type LoginBody = { password?: unknown };

export async function POST(request: Request) {
  const appPassword = process.env.APP_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!appPassword || !sessionSecret) {
    return Response.json(
      {
        ok: false,
        error:
          "Server is missing APP_PASSWORD or SESSION_SECRET. Set both in the environment before logging in.",
      },
      { status: 500 },
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 },
    );
  }

  const submitted = typeof body.password === "string" ? body.password : "";
  if (!constantTimeEqualString(submitted, appPassword)) {
    return Response.json(
      { ok: false, error: "Incorrect password" },
      { status: 401 },
    );
  }

  const token = signSession(sessionSecret, { issuedAt: Date.now() });
  const cookieHeader = serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: process.env.NODE_ENV === "production",
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader,
    },
  });
}
