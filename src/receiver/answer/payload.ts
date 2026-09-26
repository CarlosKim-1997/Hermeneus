import type { InterpretationAuthorityItem } from "../interpretation-authority.js";
import type { GeneratedAnswerProposal } from "./proposal-schema.js";

export function buildGeneratorPayload(question: string, items: readonly InterpretationAuthorityItem[]) {
  return {
    question,
    items: items.map(({ id, type, statement, priority }) => ({ id, type, statement, priority })),
  };
}

export function buildVerifierPayload(
  question: string,
  selectedItems: readonly InterpretationAuthorityItem[],
  proposal: GeneratedAnswerProposal,
) {
  return {
    question,
    items: selectedItems.map(({ id, type, statement, priority }) => ({ id, type, statement, priority })),
    sentences: proposal.sentences,
  };
}
