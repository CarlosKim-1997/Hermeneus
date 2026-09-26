import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { readCreatorAuthConfig } from "../creator/auth-config.js";
import { applyVerifiedExternalAccountToToken } from "../application/external-auth-callback.js";

export function buildExternalAuthConfig(): NextAuthConfig | null {
  const config = readCreatorAuthConfig();
  if (config.mode !== "external") {
    return null;
  }

  return {
    providers: [
      Google({
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
      }),
    ],
    secret: config.authSecret,
    session: { strategy: "jwt" },
    trustHost: true,
    callbacks: {
      async jwt({ token, account }) {
        const updated = await applyVerifiedExternalAccountToToken({ creatorId: token.creatorId as string | undefined }, account);
        if (updated.creatorId) {
          token.creatorId = updated.creatorId;
        }
        return token;
      },
      async session({ session, token }) {
        if (typeof token.creatorId === "string") {
          (session as { creatorId?: string }).creatorId = token.creatorId;
        }
        return session;
      },
    },
  };
}

type AuthExports = ReturnType<typeof NextAuth>;

let cached: AuthExports | null | undefined;

export function getHermeneusAuth(): AuthExports | null {
  if (cached !== undefined) {
    return cached;
  }
  const config = buildExternalAuthConfig();
  cached = config ? NextAuth(config) : null;
  return cached;
}
