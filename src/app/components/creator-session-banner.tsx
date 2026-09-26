import { isDevCreatorAuthAllowedInRuntime, readCreatorAuthConfig } from "../../creator/auth-config.js";
import { signOutAction } from "../../application/auth-actions.js";

export async function CreatorSessionBanner() {
  const config = readCreatorAuthConfig();
  if (!isDevCreatorAuthAllowedInRuntime() || config.mode !== "dev") return null;

  return (
    <p className="receiver-notice">
      Development Creator session ({config.devCreatorId}).{" "}
      <form action={signOutAction} style={{ display: "inline" }}>
        <button type="submit">Sign out</button>
      </form>
    </p>
  );
}
