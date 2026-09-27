import { getHermeneusAuth } from "../auth/hermeneus-auth.js";
import { readCreatorAuthConfig } from "../creator/auth-config.js";
import type { CreatorSessionProvider } from "../creator/session-provider.js";
import { resolveCreatorPrincipalFromExternalSession } from "./external-session-resolver.js";
import { getRepositories } from "./runtime.js";

export class AuthJsCreatorSessionProvider implements CreatorSessionProvider {
  async getCurrentPrincipal() {
    const config = readCreatorAuthConfig();
    if (config.mode !== "external") return undefined;

    const auth = getHermeneusAuth();
    if (!auth) return undefined;

    const session = await auth.auth();
    const repos = getRepositories();
    return resolveCreatorPrincipalFromExternalSession(session, (id) => repos.creators.exists(id));
  }
}
