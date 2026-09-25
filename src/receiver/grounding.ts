import type { HandoffItem, PublishedHandoff } from "../handoff/schema.js";
import { interpretPublished, type Interpretation } from "./interpret.js";

export type ModelProposal = {
  classification: Interpretation["classification"];
  answer: string;
  citations: string[];
};

export interface AnswerModel {
  propose(input: { question: string; items: readonly HandoffItem[] }): ModelProposal;
}

/**
 * Model output cannot outrank the published handoff. OPEN and UNKNOWN domain
 * results are kept even if a model tries to fill them in.
 */
export function interpretWithModel(
  question: string,
  published: PublishedHandoff,
  model: AnswerModel,
): Interpretation {
  const domain = interpretPublished(question, published);
  if (domain.classification === "OPEN" || domain.classification === "UNKNOWN") return domain;

  const proposal = model.propose({ question, items: published.items });
  if (proposal.classification !== domain.classification) return domain;
  const cited = proposal.citations.map((id) => published.items.find((item) => item.id === id));
  if (cited.some((item) => !item)) return domain;
  const groundedItems = cited.filter((item): item is HandoffItem => Boolean(item));
  if (!answerUsesOnlyItems(proposal.answer, groundedItems)) return domain;
  return {
    classification: domain.classification,
    answer: proposal.answer,
    citations: proposal.citations,
  };
}

function answerUsesOnlyItems(answer: string, items: HandoffItem[]): boolean {
  let rest = answer.toLowerCase();
  for (const item of items) rest = rest.replaceAll(item.statement.toLowerCase(), " ");
  rest = rest.replace(/\b(no|yes|this is still tentative)\b/g, " ");
  rest = rest.replace(/[^a-z0-9\s]/g, " ");
  const leftovers = rest.split(/\s+/).filter((token) => token.length >= 3);
  return leftovers.length === 0;
}
