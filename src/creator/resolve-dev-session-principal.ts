import type { CreatorAuthConfig } from "./auth-config.js";
import { isDevCreatorAuthAllowedInRuntime } from "./auth-config.js";
import { verifySignedSessionToken } from "./dev-session.js";
import type { VerifiedDevSession } from "./dev-session.js";

export function resolveDevSessionCredential(input: {
  sessionToken: string | undefined;
  config: CreatorAuthConfig;
  nowMs?: number;
}): VerifiedDevSession | undefined {
  if (!isDevCreatorAuthAllowedInRuntime()) {
    return undefined;
  }
  if (input.config.mode !== "dev") {
    return undefined;
  }
  if (!input.sessionToken) {
    return undefined;
  }
  return verifySignedSessionToken(input.sessionToken, input.config.sessionSecret, input.nowMs);
}
