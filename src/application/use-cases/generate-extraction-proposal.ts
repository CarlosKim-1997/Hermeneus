import type { HandoffItem } from "../../handoff/schema.js";
import type { HandoffExtractor } from "../../extraction/extractor.js";
import { materializeExtractionProposal } from "../../extraction/materialize.js";
import { validateExtractionProposal } from "../../extraction/validation.js";
import { CreatorSourceRead } from "../creator-source-read.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export type ExtractionSuggestionResult = {
  suggestions: HandoffItem[];
};

export async function generateHandoffExtractionProposal(
  repos: Repos,
  extractor: HandoffExtractor,
  handoffId: string,
): Promise<ExtractionSuggestionResult> {
  const conversationId = await repos.handoffs.getSourceConversationId(handoffId);
  if (!conversationId) {
    throw new Error(`Handoff ${handoffId} is not bound to a source conversation`);
  }

  const sourceRead = new CreatorSourceRead(repos.conversations);
  const conversation = await sourceRead.getSourceConversation(conversationId);
  if (!conversation) {
    throw new Error(`Source conversation ${conversationId} was not found`);
  }

  const proposal = await extractor.extract(conversation);
  const validated = validateExtractionProposal(conversation, proposal);
  const materialized = materializeExtractionProposal(handoffId, validated);

  return { suggestions: materialized.items };
}
