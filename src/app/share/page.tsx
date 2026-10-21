import type { Metadata } from "next";
import { isReceiverSemanticModeConfigured } from "../../application/receiver-interpreter-config";
import { isOpenAiExternalVerifierConfigured } from "../../receiver/external/openai-verifier";
import { ShareFragmentEntry } from "../components/share-fragment-entry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "공유받은 전달본 · Hermeneus",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SharedReceiverPage() {
  return (
    <section>
      <ShareFragmentEntry
        semanticModeEnabled={isReceiverSemanticModeConfigured()}
        externalVerifierEnabled={isOpenAiExternalVerifierConfigured()}
        mcpOrigin={process.env.HERMENEUS_MCP_ALPHA_ORIGIN === "https://hermeneus-mcp-alpha.vercel.app" ? process.env.HERMENEUS_MCP_ALPHA_ORIGIN : undefined}
      />
    </section>
  );
}
