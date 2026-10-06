import { createHmac, timingSafeEqual } from "node:crypto";
export type VerifiedDevSession = {
  creatorId: string;
};

export const CREATOR_SESSION_COOKIE_NAME = "hermeneus_creator_session";

type SessionPayload = {
  creatorId: string;
  issuedAt: number;
  expiresAt: number;
};

function signPayload(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createSignedSessionToken(input: {
  creatorId: string;
  issuedAt: number;
  expiresAt: number;
  secret: string;
}): string {
  const payloadB64 = Buffer.from(
    JSON.stringify({
      creatorId: input.creatorId,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
    } satisfies SessionPayload),
  ).toString("base64url");
  const signature = signPayload(payloadB64, input.secret);
  return `${payloadB64}.${signature}`;
}

export function verifySignedSessionToken(token: string, secret: string, nowMs = Date.now()): VerifiedDevSession | undefined {
  const parts = token.split(".");
  if (parts.length !== 2) return undefined;
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return undefined;

  const expected = signPayload(payloadB64, secret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return undefined;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return undefined;
  }

  if (!payload.creatorId || typeof payload.expiresAt !== "number" || typeof payload.issuedAt !== "number") {
    return undefined;
  }
  if (payload.expiresAt <= nowMs) return undefined;

  return { creatorId: payload.creatorId };
}
