import { googleSignInAction } from "../../application/auth-actions.js";

export function GoogleSignInForm() {
  return (
    <form action={googleSignInAction}>
      <button type="submit">Sign in with Google</button>
    </form>
  );
}
