import { cookies } from "next/headers";
import { readCreatorAuthConfig } from "../creator/auth-config.js";
import { CREATOR_SESSION_COOKIE_NAME } from "../creator/dev-session.js";
import { resolveDevSessionCredential } from "../creator/resolve-dev-session-principal.js";
import type { CreatorSessionProvider } from "../creator/session-provider.js";
import { resolveCreatorPrincipalWithLifecycle } from "./creator-lifecycle-session.js";
import { getRepositories } from "./runtime.js";

export class CookieCreatorSessionProvider implements CreatorSessionProvider {
  async getCurrentPrincipal() {
    const config = readCreatorAuthConfig();
    const cookieStore = await cookies();
    const token = cookieStore.get(CREATOR_SESSION_COOKIE_NAME)?.value;
    const credential = resolveDevSessionCredential({ sessionToken: token, config });
    if (!credential) return undefined;
    const repos = getRepositories();
    return resolveCreatorPrincipalWithLifecycle(repos, credential.creatorId);
  }
}
