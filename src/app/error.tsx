"use client";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="panel login-panel" role="alert">
      <p className="eyebrow">화면을 불러오지 못했어요</p>
      <h2>잠시 연결을 확인해주세요.</h2>
      <p>아래에서 다시 시도할 수 있습니다. 문제가 계속되면 잠시 후 방문해주세요.</p>
      <button type="button" className="primary" onClick={reset}>다시 불러오기</button>
    </section>
  );
}
