import { notFound } from "next/navigation";
import { isReceiverSemanticModeConfigured } from "../../../../application/receiver-interpreter-config";
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
      <ReceiverConsole
        handoffId={view.handoffId}
        version={view.version}
        publishedAt={view.publishedAt}
        items={view.items}
        semanticModeEnabled={isReceiverSemanticModeConfigured()}
      />
    </section>
  );
}
