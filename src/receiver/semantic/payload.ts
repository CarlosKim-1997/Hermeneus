import type { InterpretationAuthorityItem } from "../interpretation-authority.js";

export function buildReceiverSemanticPayload(
  question: string,
  items: readonly InterpretationAuthorityItem[],
): { question: string; items: Array<{ id: string; type: string; statement: string; priority: string }> } {
  return {
    question,
    items: items.map(({ id, type, statement, priority }) => ({
      id,
      type,
      statement,
      priority,
    })),
  };
}
