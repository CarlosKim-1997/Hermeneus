import { readCreatorAuthConfig, isDevCreatorAuthAllowedInRuntime } from "../../creator/auth-config.js";
import { DevSignInForm } from "../components/dev-sign-in-form";

export default function LoginPage() {
  const config = readCreatorAuthConfig();
  const devAllowed = isDevCreatorAuthAllowedInRuntime() && config.mode === "dev";

  return (
    <section className="panel">
      <h2>Creator sign-in</h2>
      {devAllowed ? (
        <>
          <p className="receiver-notice">
            Development Creator session. Production authentication provider is not configured.
          </p>
          <DevSignInForm showSecondary={Boolean(config.mode === "dev" && config.devCreatorIdSecondary)} />
        </>
      ) : (
        <p>Creator authentication is disabled. Set CREATOR_AUTH_MODE=dev with DEV_CREATOR_ID and CREATOR_SESSION_SECRET for local development.</p>
      )}
    </section>
  );
}
