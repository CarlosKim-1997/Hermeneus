import { readCreatorAuthConfig, isDevCreatorAuthAllowedInRuntime } from "../../creator/auth-config.js";
import { DevSignInForm } from "../components/dev-sign-in-form";
import { GoogleSignInForm } from "../components/google-sign-in-form";

export default function LoginPage() {
  const config = readCreatorAuthConfig();
  const devAllowed = isDevCreatorAuthAllowedInRuntime() && config.mode === "dev";
  const externalAllowed = config.mode === "external";

  return (
    <section className="panel login-panel">
      <p className="eyebrow">맥락을 이어주는 전달</p>
      <h2>설명을 반복하는 일을 줄여보세요.</h2>
      <p className="login-intro">내 AI와 정리하고, 내가 확인한 의미를 전하세요.</p>
      {externalAllowed ? (
        <>
          <p>Google로 로그인하면 전달 초안을 만들고, 검토한 전달본을 링크로 공유할 수 있습니다.</p>
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
