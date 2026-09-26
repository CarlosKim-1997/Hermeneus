import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchReceiverPublishedViewAction } from "../../../../application/receiver-actions";
import { ReceiverConsole } from "../../../components/receiver-console";

export default async function ReceiverPage({
  params,
}: {
  params: Promise<{ handoffId: string; version: string }>;
}) {
  const { handoffId, version: versionRaw } = await params;
  const version = Number(versionRaw);
  if (!Number.isInteger(version) || version <= 0) notFound();

  const view = await fetchReceiverPublishedViewAction(handoffId, version);
  if (!view) notFound();

  return (
    <section>
      <h2>Receiver</h2>
      <p>
        Handoff <code>{handoffId}</code> · explicit version {version}
      </p>
      <p>
        <Link href={`/handoffs/${handoffId}/published/${version}`}>View publication record</Link>
      </p>
      <ReceiverConsole
        handoffId={view.handoffId}
        version={view.version}
        publishedAt={view.publishedAt}
        items={view.items}
      />
    </section>
  );
}
