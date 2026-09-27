import Link from "next/link";
import { requireCreatorSessionPage } from "../../application/creator-page-guards.js";
import { getRepositories } from "../../application/runtime.js";
import { listCreatorHandoffs } from "../../application/use-cases/list-creator-handoffs.js";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

export default async function CreatorHandoffLibraryPage() {
  const principal = await requireCreatorSessionPage();
  const repos = getRepositories();
  const handoffs = await listCreatorHandoffs(repos, principal.creatorId);

  return (
    <section className="panel">
      <header className="library-header">
        <h2>Your Handoffs</h2>
        <Link className="primary button-link" href="/new">
          New Handoff
        </Link>
      </header>

      {handoffs.length === 0 ? (
        <div className="empty-state">
          <p>You haven&apos;t created a Handoff yet.</p>
          <p>
            <Link href="/new">Create your first Handoff</Link>
          </p>
        </div>
      ) : (
        <ul className="handoff-library-list">
          {handoffs.map((handoff) => (
            <li key={handoff.handoffId} className="handoff-library-item">
              <div>
                <strong>{handoff.handoffId}</strong>
                <p>Created {formatWhen(handoff.createdAt)}</p>
                <p>Draft revision {handoff.draftRevision}</p>
                <p>Last draft update {formatWhen(handoff.draftUpdatedAt)}</p>
                <p>
                  {handoff.latestPublishedVersion !== undefined
                    ? `Published v${handoff.latestPublishedVersion} (${formatWhen(handoff.latestPublishedAt!)})`
                    : "Not published"}
                </p>
              </div>
              <div className="actions">
                <Link href={`/handoffs/${handoff.handoffId}/review`}>Review</Link>
                {handoff.latestPublishedVersion !== undefined ? (
                  <Link href={`/handoffs/${handoff.handoffId}/published/${handoff.latestPublishedVersion}`}>
                    Open latest published
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
