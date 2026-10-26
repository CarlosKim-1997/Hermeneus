import { readCreatorAuthConfig, isDevCreatorAuthAllowedInRuntime } from "../../creator/auth-config.js";
import { DevSignInForm } from "../components/dev-sign-in-form";
import { GoogleSignInForm } from "../components/google-sign-in-form";

export default function LoginPage() {
  const config = readCreatorAuthConfig();
  const devAllowed = isDevCreatorAuthAllowedInRuntime() && config.mode === "dev";
  const externalAllowed = config.mode === "external";

  return (
    <section className="panel login-panel">

      <h2>Hermeneus에 로그인</h2>

      {externalAllowed ? (
        <>
          <p>전달할 내용을 정리하고 공유 링크를 만들 수 있습니다.</p>
          <GoogleSignInForm />
        </>
      ) : null}
      {devAllowed ? (
        <>
          <p className="receiver-notice">
            개발용 로그인입니다. 실제 서비스 인증과 연결되지 않은 테스트 환경입니다.
          </p>
          <DevSignInForm showSecondary={Boolean(config.mode === "dev" && config.devCreatorIdSecondary)} />
        </>
      ) : null}
      {!externalAllowed && !devAllowed ? (
        <p>지금은 로그인할 수 없습니다. 잠시 후 다시 시도해주세요. 서비스 담당자의 인증 설정 확인이 필요합니다.</p>
      ) : null}
    </section>
  );
}
