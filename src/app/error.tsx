"use client";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="panel login-panel" role="alert">
      <p className="eyebrow">Something went wrong</p>
      <h2>We could not load this view.</h2>
      <p>Try loading it again. If the problem continues, return later.</p>
      <button type="button" className="primary" onClick={reset}>Try again</button>
    </section>
  );
}
