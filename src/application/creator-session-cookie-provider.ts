import { cookies } from "next/headers";
import { readCreatorAuthConfig } from "../creator/auth-config.js";
import { CREATOR_SESSION_COOKIE_NAME } from "../creator/dev-session.js";
import { resolveDevSessionPrincipal } from "../creator/resolve-dev-session-principal.js";
import type { CreatorSessionProvider } from "../creator/session-provider.js";

export class CookieCreatorSessionProvider implements CreatorSessionProvider {
  async getCurrentPrincipal() {
    const config = readCreatorAuthConfig();
    const cookieStore = await cookies();
    const token = cookieStore.get(CREATOR_SESSION_COOKIE_NAME)?.value;
    return resolveDevSessionPrincipal({ sessionToken: token, config });
  }
}
