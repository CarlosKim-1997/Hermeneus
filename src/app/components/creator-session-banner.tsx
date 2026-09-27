import { isDevCreatorAuthAllowedInRuntime, readCreatorAuthConfig } from "../../creator/auth-config.js";
import { signOutAction } from "../../application/auth-actions.js";
import { getOptionalCreatorSessionPage } from "../../application/creator-page-guards.js";

export async function CreatorSessionBanner() {
  const config = readCreatorAuthConfig();
  const principal = await getOptionalCreatorSessionPage();

  if (config.mode === "external" && principal) {
    return (
      <p className="receiver-notice">
        Signed in as Creator ({principal.creatorId}).{" "}
        <form action={signOutAction} style={{ display: "inline" }}>
          <button type="submit">Sign out</button>
        </form>
      </p>
    );
  }

  if (isDevCreatorAuthAllowedInRuntime() && config.mode === "dev" && principal) {
    return (
      <p className="receiver-notice">
        Development Creator session ({principal.creatorId}).{" "}
        <form action={signOutAction} style={{ display: "inline" }}>
          <button type="submit">Sign out</button>
        </form>
      </p>
    );
  }

  return null;
}
