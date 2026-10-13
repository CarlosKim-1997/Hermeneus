export default function Loading() {
  return (
    <section className="panel loading-panel" role="status" aria-label="Loading Handoff view">
      <p className="eyebrow">One moment</p>
      <p>Loading your view…</p>
      <div className="loading-line" aria-hidden="true" />
      <div className="loading-line loading-line-short" aria-hidden="true" />
    </section>
  );
}
