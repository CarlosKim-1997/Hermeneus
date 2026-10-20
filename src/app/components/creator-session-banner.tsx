import { isDevCreatorAuthAllowedInRuntime, readCreatorAuthConfig } from "../../creator/auth-config.js";
import { signOutAction } from "../../application/auth-actions.js";
import { getOptionalCreatorSessionPage } from "../../application/creator-page-guards.js";

export async function CreatorSessionBanner() {
  const config = readCreatorAuthConfig();
  const principal = await getOptionalCreatorSessionPage();

  if (config.mode === "external" && principal) {
    return (
      <div className="creator-session">
        <div><p>내 계정으로 작업 중</p><details className="session-id"><summary>계정 식별 정보</summary><code>{principal.creatorId}</code></details></div>
        <form action={signOutAction}>
          <button type="submit">로그아웃</button>
        </form>
      </div>
    );
  }

  if (isDevCreatorAuthAllowedInRuntime() && config.mode === "dev" && principal) {
    return (
      <div className="creator-session">
        <div><p>개발용 테스트 계정</p><details className="session-id"><summary>계정 식별 정보</summary><code>{principal.creatorId}</code></details></div>
        <form action={signOutAction}>
          <button type="submit">로그아웃</button>
        </form>
      </div>
    );
  }

  return null;
}
