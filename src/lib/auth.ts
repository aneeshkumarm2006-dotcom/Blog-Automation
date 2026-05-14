import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "bf_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SessionPayload = { issuedAt: number };

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function signPayload(secret: string, payloadJson: string): string {
  return base64UrlEncode(
    createHmac("sha256", secret).update(payloadJson).digest(),
  );
}

export function signSession(secret: string, payload: SessionPayload): string {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson, "utf8"));
  const signature = signPayload(secret, payloadJson);
  return `${payloadB64}.${signature}`;
}

export function verifySession(cookieValue: string, secret: string): boolean {
  if (!cookieValue || !secret) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;

  let payloadJson: string;
  try {
    payloadJson = base64UrlDecode(payloadB64).toString("utf8");
  } catch {
    return false;
  }

  const expected = signPayload(secret, payloadJson);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(payloadJson) as SessionPayload;
  } catch {
    return false;
  }
  if (typeof payload.issuedAt !== "number") return false;
  if (Date.now() - payload.issuedAt > SESSION_TTL_MS) return false;
  return true;
}

export function constantTimeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
