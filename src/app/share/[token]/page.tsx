import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isReceiverSemanticModeConfigured } from "../../../application/receiver-interpreter-config";
import { loadSharedReceiverViewAction } from "../../../application/share-actions";
import { SharedReceiverConsole } from "../../components/shared-receiver-console";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Shared Handoff · Hermeneus",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function SharedReceiverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadSharedReceiverViewAction(token);
  if (!view) notFound();

  return (
    <section>
      <h2>Shared Receiver</h2>
      <p className="receiver-notice">Access is authorized through this share link only. Canonical Handoff items remain the authority.</p>
      <SharedReceiverConsole
        token={token}
        version={view.version}
        publishedAt={view.publishedAt}
        items={view.items}
        semanticModeEnabled={isReceiverSemanticModeConfigured()}
      />
    </section>
  );
}
