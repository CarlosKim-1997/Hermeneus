import { isDevCreatorAuthAllowedInRuntime, readCreatorAuthConfig } from "../../creator/auth-config.js";
import { signOutAction } from "../../application/auth-actions.js";
import { getOptionalCreatorSessionPage } from "../../application/creator-page-guards.js";

export async function CreatorSessionBanner() {
  const config = readCreatorAuthConfig();
  const principal = await getOptionalCreatorSessionPage();

  if (config.mode === "external" && principal) {
    return (
      <div className="creator-session">
        <p>Signed in as Creator <span className="session-id">({principal.creatorId}).</span></p>
        <form action={signOutAction}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    );
  }

  if (isDevCreatorAuthAllowedInRuntime() && config.mode === "dev" && principal) {
    return (
      <div className="creator-session">
        <p>Development Creator session <span className="session-id">({principal.creatorId}).</span></p>
        <form action={signOutAction}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    );
  }

  return null;
}
