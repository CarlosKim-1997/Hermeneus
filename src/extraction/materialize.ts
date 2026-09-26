import { createDraft } from "../handoff/draft.js";
import type { DraftHandoff, HandoffItem } from "../handoff/schema.js";
import type { ExtractionProposal } from "./proposal-schema.js";

export function generateHandoffItemId(): string {
  return `item_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Turn a validated proposal into draft-shaped items (proposal only — not persisted). */
export function materializeExtractionProposal(
  handoffId: string,
  proposal: ExtractionProposal,
  options?: { itemIds?: string[] },
): DraftHandoff {
  const items: HandoffItem[] = proposal.candidates.map((candidate, index) => ({
    id: options?.itemIds?.[index] ?? generateHandoffItemId(),
    type: candidate.type,
    statement: candidate.statement,
    priority: candidate.priority,
    createdBy: "EXTRACTION",
    sources: candidate.sources.map((source) => ({ messageId: source.messageId, excerpt: source.excerpt })),
  }));
  return createDraft(handoffId, items);
}
