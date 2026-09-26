import type { GeneratedAnswerProposal } from "./proposal-schema.js";

export const MAX_GENERATED_SENTENCES = 4;

export type GeneratedProposalValidation =
  | { ok: true; proposal: GeneratedAnswerProposal }
  | { ok: false; reason: string };

export function validateGeneratedAnswerProposal(
  proposal: GeneratedAnswerProposal,
  allowedCitationIds: ReadonlySet<string>,
): GeneratedProposalValidation {
  if (proposal.sentences.length === 0) {
    return { ok: false, reason: "Generated answer must contain at least one sentence." };
  }
  if (proposal.sentences.length > MAX_GENERATED_SENTENCES) {
    return { ok: false, reason: `Generated answer exceeds ${MAX_GENERATED_SENTENCES} sentences.` };
  }

  for (const [index, sentence] of proposal.sentences.entries()) {
    if (!sentence.text.trim()) {
      return { ok: false, reason: `Sentence ${index} is empty.` };
    }
    if (sentence.citationIds.length === 0) {
      return { ok: false, reason: `Sentence ${index} has no citations.` };
    }
    for (const id of sentence.citationIds) {
      if (!allowedCitationIds.has(id)) {
        return { ok: false, reason: `Sentence ${index} cites disallowed id: ${id}` };
      }
    }
  }

  return { ok: true, proposal };
}

export function validateGroundingVerification(
  verification: import("./proposal-schema.js").GroundingVerification,
  proposal: GeneratedAnswerProposal,
  allowedCitationIds: ReadonlySet<string>,
): boolean {
  if (verification.verdict !== "GROUNDED") return false;
  if (verification.sentenceResults.length !== proposal.sentences.length) return false;

  for (const result of verification.sentenceResults) {
    if (!result.grounded) return false;
    if (result.index < 0 || result.index >= proposal.sentences.length) return false;
    if (result.citationIds.length === 0) return false;
    for (const id of result.citationIds) {
      if (!allowedCitationIds.has(id)) return false;
    }
  }
  return true;
}
