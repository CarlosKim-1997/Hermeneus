"use client";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="panel login-panel" role="alert">
      <h2>화면을 불러오지 못했습니다</h2>
      <p>다시 불러와주세요. 계속 열리지 않으면 잠시 후 다시 시도해주세요.</p>
      <button type="button" className="primary" onClick={reset}>다시 불러오기</button>
    </section>
  );
}
