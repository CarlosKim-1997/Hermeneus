import { createHash, randomBytes } from "node:crypto";

export const SHARE_TOKEN_PREFIX = "hsh_";
const SECRET_BYTE_LENGTH = 32;

export function generateShareToken(): string {
  return `${SHARE_TOKEN_PREFIX}${randomBytes(SECRET_BYTE_LENGTH).toString("base64url")}`;
}

export function hashShareToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function isShareTokenFormat(rawToken: string): boolean {
  if (!rawToken.startsWith(SHARE_TOKEN_PREFIX)) return false;
  const secretPart = rawToken.slice(SHARE_TOKEN_PREFIX.length);
  if (secretPart.length < 43) return false;
  return /^[A-Za-z0-9_-]+$/.test(secretPart);
}
