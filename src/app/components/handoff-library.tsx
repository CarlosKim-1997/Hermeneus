import Link from "next/link";
import type { CreatorHandoffSummary } from "../../handoff/creator-handoff-summary.js";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}

export function HandoffLibrary({ handoffs }: { handoffs: readonly CreatorHandoffSummary[] }) {
  return (
    <section className="panel handoff-library" aria-labelledby="library-title">
      <header className="library-header">
        <div>
          <p className="library-eyebrow">Your workspace</p>
          <h2 id="library-title">Your Handoffs</h2>
          <p className="library-description">Review your drafts and return to the versions you have published.</p>
        </div>
        <Link className="button-link library-create" href="/new">New Handoff <span aria-hidden="true">＋</span></Link>
      </header>

      {handoffs.length === 0 ? (
        <div className="library-empty">
          <span className="library-empty-icon" aria-hidden="true">↗</span>
          <h3>Your first Handoff starts here</h3>
          <p>You haven&apos;t created a Handoff yet. Bring a proposal or conversation, review its claims, then publish a version to share.</p>
          <Link className="button-link" href="/new">Create your first Handoff</Link>
          <p className="library-empty-hint">You review the Draft before anything is published.</p>
        </div>
      ) : (
        <>
          <p className="library-count">{handoffs.length} {handoffs.length === 1 ? "Handoff" : "Handoffs"} <span>· Dates in UTC</span></p>
          <ul className="handoff-library-list">
            {handoffs.map((handoff) => {
              const published = handoff.latestPublishedVersion !== undefined;
              return (
                <li key={handoff.handoffId} className="handoff-library-item">
                  <div className="library-card-header">
                    <h3>{handoff.displayTitle ?? handoff.handoffId}</h3>
                    <span className={`library-status ${published ? "library-status-published" : "library-status-draft"}`}>
                      {published ? "Published" : "Draft"}
                    </span>
                  </div>
                  {handoff.displayTitle ? <p className="library-id">Handoff ID {handoff.handoffId}</p> : null}
                  <dl className="library-metadata">
                    <div><dt>Draft</dt><dd>Revision {handoff.draftRevision}</dd></div>
                    <div><dt>Updated</dt><dd><time dateTime={handoff.draftUpdatedAt}>{formatDate(handoff.draftUpdatedAt)}</time></dd></div>
                    <div><dt>Published</dt><dd>{published ? `Version ${handoff.latestPublishedVersion}` : "Not yet published"}</dd></div>
                  </dl>
                  <details className="library-dates">
                    <summary>More dates</summary>
                    <p>Created <time dateTime={handoff.createdAt}>{formatDate(handoff.createdAt)}</time></p>
                    {handoff.latestPublishedAt ? <p>Last published <time dateTime={handoff.latestPublishedAt}>{formatDate(handoff.latestPublishedAt)}</time></p> : null}
                  </details>
                  <div className="library-card-actions">
                    <Link className="library-action" href={`/handoffs/${handoff.handoffId}/review`}>Review draft <span aria-hidden="true">→</span></Link>
                    {published ? <Link className="library-action library-action-published" href={`/handoffs/${handoff.handoffId}/published/${handoff.latestPublishedVersion}`}>View published <span aria-hidden="true">↗</span></Link> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
