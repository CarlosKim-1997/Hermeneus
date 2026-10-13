import { googleSignInAction } from "../../application/auth-actions.js";

export function GoogleSignInForm() {
  return (
    <form action={googleSignInAction}>
      <button type="submit" className="primary">Sign in with Google</button>
    </form>
  );
}
