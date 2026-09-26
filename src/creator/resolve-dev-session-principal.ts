import type { CreatorAuthConfig } from "./auth-config.js";
import { isDevCreatorAuthAllowedInRuntime } from "./auth-config.js";
import { verifySignedSessionToken } from "./dev-session.js";
import type { CreatorPrincipal } from "./types.js";

export function resolveDevSessionPrincipal(input: {
  sessionToken: string | undefined;
  config: CreatorAuthConfig;
  nowMs?: number;
}): CreatorPrincipal | undefined {
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
