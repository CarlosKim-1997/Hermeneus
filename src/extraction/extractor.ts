import { createDraft } from "../handoff/draft.js";
import type { DraftHandoff, HandoffItem } from "../handoff/schema.js";
import type { NormalizedConversation } from "../import/types.js";

export interface HandoffExtractor {
  extract(conversation: NormalizedConversation): Promise<DraftHandoff>;
}

/** Deterministic test double. Extraction stays a draft and is never published here. */
export function fixtureExtractor(
  handoffId: string,
  items: Array<Omit<HandoffItem, "createdBy">>,
): HandoffExtractor {
  return {
    async extract() {
      return createDraft(
        handoffId,
        items.map((item) => ({ ...item, createdBy: "EXTRACTION" as const })),
      );
    },
  };
}
