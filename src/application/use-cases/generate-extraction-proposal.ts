import type { HandoffItem } from "../../handoff/schema.js";
import type { HandoffExtractor } from "../../extraction/extractor.js";
import { materializeExtractionProposal } from "../../extraction/materialize.js";
import { validateExtractionProposal } from "../../extraction/validation.js";
import { SourceUnavailableError } from "../../persistence/errors.js";
import { CreatorSourceRead } from "../creator-source-read.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export type ExtractionSuggestionResult = {
  suggestions: HandoffItem[];
};

async function assertActiveCreatorOwner(repos: Repos, handoffId: string): Promise<void> {
  const owner = await repos.handoffs.getOwnerCreatorId(handoffId);
  if (!owner) {
    throw new SourceUnavailableError(
      "Source provenance has been erased for this Handoff. AI suggestions are no longer available.",
    );
  }
  const lifecycle = await repos.creators.getLifecycleStatus(owner);
  if (lifecycle !== "active") {
    throw new SourceUnavailableError(
      "Source provenance has been erased for this Handoff. AI suggestions are no longer available.",
    );
  }
}

function assertRetainedSource(repos: Repos, handoffId: string) {
  return repos.handoffs.getHandoffSourceState(handoffId).then((state) => {
    if (!state || state.kind !== "retained") {
      throw new SourceUnavailableError(
        "Source provenance has been erased for this Handoff. AI suggestions are no longer available.",
      );
    }
    return state.conversationId;
  });
}

export async function generateHandoffExtractionProposal(
  repos: Repos,
  extractor: HandoffExtractor,
  handoffId: string,
): Promise<ExtractionSuggestionResult> {
  const conversationId = await assertRetainedSource(repos, handoffId);
  await assertActiveCreatorOwner(repos, handoffId);

  const sourceRead = new CreatorSourceRead(repos.conversations);
  const conversation = await sourceRead.getSourceConversation(conversationId);
  if (!conversation) {
    throw new SourceUnavailableError(
      "Source provenance has been erased for this Handoff. AI suggestions are no longer available.",
    );
  }

  const proposal = await extractor.extract(conversation);

  await assertRetainedSource(repos, handoffId);
  await assertActiveCreatorOwner(repos, handoffId);

  const validated = validateExtractionProposal(conversation, proposal);
  const materialized = materializeExtractionProposal(handoffId, validated);

  await assertRetainedSource(repos, handoffId);

  return { suggestions: materialized.items };
}
