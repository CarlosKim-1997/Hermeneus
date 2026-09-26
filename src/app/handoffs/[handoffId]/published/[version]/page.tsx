import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPublishedHandoff } from "../../../../../application/actions";
import { listShareCapabilitiesAction } from "../../../../../application/share-actions";
import { ShareCapabilityPanel } from "../../../../components/share-capability-panel";

export default async function PublishedPage({
  params,
}: {
  params: Promise<{ handoffId: string; version: string }>;
}) {
  const { handoffId, version: versionRaw } = await params;
  const version = Number(versionRaw);
  if (!Number.isInteger(version) || version <= 0) notFound();

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
          {item.sources.length ? (
            <ul>
              {item.sources.map((source) => (
                <li key={`${item.id}-${source.messageId}`}>
                  Message {source.messageId}
                  {source.excerpt ? `: "${source.excerpt}"` : " (no excerpt)"}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </section>
  );
}
