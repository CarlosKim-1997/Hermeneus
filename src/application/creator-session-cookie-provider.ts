import { cookies } from "next/headers";
import { readCreatorAuthConfig } from "../creator/auth-config.js";
import { CREATOR_SESSION_COOKIE_NAME, verifySignedSessionToken } from "../creator/dev-session.js";
import type { CreatorSessionProvider } from "../creator/session-provider.js";

export class CookieCreatorSessionProvider implements CreatorSessionProvider {
  async getCurrentPrincipal() {
    const config = readCreatorAuthConfig();
    if (config.mode !== "dev") return undefined;

    const cookieStore = await cookies();
    const token = cookieStore.get(CREATOR_SESSION_COOKIE_NAME)?.value;
    if (!token) return undefined;
    return verifySignedSessionToken(token, config.sessionSecret);
  }
}
