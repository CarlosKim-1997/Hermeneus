import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { readAuthTrustHostPolicy, readCreatorAuthConfig } from "../creator/auth-config.js";
import { applyVerifiedExternalAccountToToken } from "../application/external-auth-callback.js";

export function buildExternalAuthOptions(): NextAuthConfig | null {
  const config = readCreatorAuthConfig();
  if (config.mode !== "external") {
    return null;
  }

  const options: NextAuthConfig = {
    providers: [
      Google({
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
      }),
    ],
    secret: config.authSecret,
    session: { strategy: "jwt" },
    callbacks: {
      async jwt({ token, account }) {
        const updated = await applyVerifiedExternalAccountToToken(
          { creatorId: token.creatorId as string | undefined },
          account,
        );
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

  const trustHost = readAuthTrustHostPolicy();
  if (trustHost !== undefined) {
    options.trustHost = trustHost;
  }

  return options;
}
