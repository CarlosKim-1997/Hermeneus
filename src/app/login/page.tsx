import { readCreatorAuthConfig, isDevCreatorAuthAllowedInRuntime } from "../../creator/auth-config.js";
import { DevSignInForm } from "../components/dev-sign-in-form";
import { GoogleSignInForm } from "../components/google-sign-in-form";

export default function LoginPage() {
  const config = readCreatorAuthConfig();
  const devAllowed = isDevCreatorAuthAllowedInRuntime() && config.mode === "dev";
  const externalAllowed = config.mode === "external";

  return (
    <section className="panel login-panel">
      <p className="eyebrow">Welcome to Hermeneus</p>
      <h2>Creator sign-in</h2>
      <p className="login-intro">Keep the meaning. Carry the conversation forward.</p>
      {externalAllowed ? (
        <>
          <p>Sign in with your external identity provider to access Creator routes.</p>
          <GoogleSignInForm />
        </>
      ) : null}
      {devAllowed ? (
        <>
          <p className="receiver-notice">
            Development Creator session. Production authentication provider is not configured.
          </p>
          <DevSignInForm showSecondary={Boolean(config.mode === "dev" && config.devCreatorIdSecondary)} />
        </>
      ) : null}
      {!externalAllowed && !devAllowed ? (
        <p>Creator authentication is unavailable. Configure CREATOR_AUTH_MODE for development or external sign-in.</p>
      ) : null}
    </section>
  );
}
