export default function Loading() {
  return (
    <section className="panel loading-panel" role="status" aria-label="전달 화면 불러오는 중">
      <p className="eyebrow">잠시만 기다려주세요</p>
      <p>전달 내용을 불러오고 있습니다…</p>
      <div className="loading-line" aria-hidden="true" />
      <div className="loading-line loading-line-short" aria-hidden="true" />
    </section>
  );
}
