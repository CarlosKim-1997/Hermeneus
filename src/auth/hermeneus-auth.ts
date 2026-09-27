import NextAuth from "next-auth";
import { buildExternalAuthOptions } from "./external-auth-options.js";

type AuthExports = ReturnType<typeof NextAuth>;

let cached: AuthExports | null | undefined;

export function getHermeneusAuth(): AuthExports | null {
  if (cached !== undefined) {
    return cached;
  }
  const config = buildExternalAuthOptions();
  cached = config ? NextAuth(config) : null;
  return cached;
}
