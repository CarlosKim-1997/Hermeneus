import { googleSignInAction } from "../../application/auth-actions.js";

export function GoogleSignInForm() {
  return (
    <form action={googleSignInAction}>
      <button type="submit" className="primary">Google로 시작하기</button>
    </form>
  );
}
