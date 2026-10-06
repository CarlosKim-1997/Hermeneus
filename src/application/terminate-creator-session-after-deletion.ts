"use server";

import { readCreatorAuthConfig } from "../creator/auth-config.js";
import { clearCreatorSessionCookie } from "./creator-session-cookie.js";

/** Best-effort session teardown after successful Account Erasure. DB lifecycle remains authoritative. */
export async function terminateCreatorSessionAfterAccountDeletion(): Promise<void> {
  const config = readCreatorAuthConfig();
  if (config.mode === "external") {
    const { getHermeneusAuth } = await import("../auth/hermeneus-auth.js");
    const auth = getHermeneusAuth();
    if (auth) {
      try {
        await auth.signOut({ redirect: false });
      } catch {
        // Stale tokens must still fail closed via lifecycle lookup.
      }
    }
    return;
  }
  await clearCreatorSessionCookie();
}
