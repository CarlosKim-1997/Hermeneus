import { authorityFromPublished } from "./interpretation-authority.js";
import type { PublishedHandoff } from "../handoff/schema.js";
import { interpretPublished, type Interpretation } from "./interpret.js";
import type { InterpretationAuthorityItem } from "./interpretation-authority.js";

export type ModelProposal = {
  classification: Interpretation["classification"];
  answer: string;
  citations: string[];
};

export interface AnswerModel {
  propose(input: { question: string; items: readonly InterpretationAuthorityItem[] }): ModelProposal;
}

export function interpretWithModel(
  question: string,
  published: PublishedHandoff,
  model: AnswerModel,
): Interpretation {
  const authority = authorityFromPublished(published);
  const domain = interpretPublished(question, authority);
  if (domain.classification === "OPEN" || domain.classification === "UNKNOWN") return domain;

  const proposal = model.propose({ question, items: authority.items });
  if (proposal.classification !== domain.classification) return domain;
  const cited = proposal.citations.map((id) => authority.items.find((item) => item.id === id));
  if (cited.some((item) => !item)) return domain;
  const groundedItems = cited.filter((item): item is InterpretationAuthorityItem => Boolean(item));
  if (!answerUsesOnlyItems(proposal.answer, groundedItems)) return domain;
  return {
    classification: domain.classification,
    answer: proposal.answer,
    citations: proposal.citations,
  };
}

function answerUsesOnlyItems(answer: string, items: InterpretationAuthorityItem[]): boolean {
  let rest = answer.toLowerCase();
  for (const item of items) rest = rest.replaceAll(item.statement.toLowerCase(), " ");
  rest = rest.replace(/\b(no|yes|this is still tentative)\b/g, " ");
  rest = rest.replace(/[^a-z0-9\s]/g, " ");
  const leftovers = rest.split(/\s+/).filter((token) => token.length >= 3);
  return leftovers.length === 0;
}
