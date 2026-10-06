import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPublishedHandoff } from "../../../../../../application/actions";
import { requireOwnedHandoffPage } from "../../../../../../application/creator-page-guards";
import { listShareCapabilitiesAction } from "../../../../../../application/share-actions";
import { ShareCapabilityPanel } from "../../../../../components/share-capability-panel";

export default async function PublishedPage({
  params,
}: {
  params: Promise<{ handoffId: string; version: string }>;
}) {
  const { handoffId, version: versionRaw } = await params;
  const version = Number(versionRaw);
  if (!Number.isInteger(version) || version <= 0) notFound();

  await requireOwnedHandoffPage(handoffId);
  const published = await fetchPublishedHandoff(handoffId, version);
  if (!published) notFound();

  const capabilityList = await listShareCapabilitiesAction({ handoffId, version });

  return (
    <section className="panel panel-published">
      <h2>Published Handoff</h2>
      <p>
        Version <strong>{published.version}</strong> · Published {new Date(published.publishedAt).toLocaleString()}
      </p>
      <p>
        <Link href={`/receiver/${handoffId}/${version}`}>Open Receiver view (pinned v{version})</Link>
        {" · "}
        <Link href={`/handoffs/${handoffId}/review`}>Return to draft review</Link>
      </p>
      <ShareCapabilityPanel
        handoffId={handoffId}
        version={version}
        initialCapabilities={capabilityList.ok ? capabilityList.capabilities : []}
      />
      {published.items.map((item) => (
        <article key={item.id} className="item-card">
          <div>
            <strong>{item.type}</strong> · {item.priority}
          </div>
          <p>{item.statement}</p>
          <p className="muted">Published canonical snapshot (provenance is stored separately; use Receiver provenance for source excerpts).</p>
        </article>
      ))}
    </section>
  );
}
