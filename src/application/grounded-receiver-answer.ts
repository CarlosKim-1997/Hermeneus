import type { InterpretationAuthorityItem } from "../receiver/interpretation-authority.js";
import { ReceiverAnswerLayerError } from "../receiver/answer/errors.js";
import { buildEpistemicPrefix } from "../receiver/answer/epistemic-prefix.js";
import type { ReceiverAnswerGenerator } from "../receiver/answer/generator.js";
import type { ReceiverGroundingVerifier } from "../receiver/answer/verifier.js";
import {
  validateGeneratedAnswerProposal,
  validateGroundingVerification,
} from "../receiver/answer/validate-generated-proposal.js";
import type { ReceiverInterpretationResult } from "./receiver-interpretation.js";

export const GROUNDED_ANSWER_FALLBACK_NOTICE =
  "Natural answer generation was unavailable; canonical rendering was used.";

export type GroundedAnswerOutcome = {
  answer: string;
  answerMode: "deterministic" | "generated-grounded";
  answerNotice?: string;
};

export async function applyGroundedNaturalAnswer(input: {
  question: string;
  interpretation: ReceiverInterpretationResult;
  selectedItems: InterpretationAuthorityItem[];
  deterministicAnswer: string;
  generator: ReceiverAnswerGenerator | null;
  verifier: ReceiverGroundingVerifier | null;
}): Promise<GroundedAnswerOutcome> {
  const { question, interpretation, selectedItems, deterministicAnswer, generator, verifier } = input;

  if (interpretation.classification !== "SUPPORTED" || !generator || !verifier || selectedItems.length === 0) {
    return { answer: deterministicAnswer, answerMode: "deterministic" };
  }

  const allowedIds = new Set(selectedItems.map((item) => item.id));

  let proposal;
  try {
    proposal = await generator.generate({ question, items: selectedItems });
  } catch (error) {
    if (error instanceof ReceiverAnswerLayerError) {
      return { answer: deterministicAnswer, answerMode: "deterministic", answerNotice: GROUNDED_ANSWER_FALLBACK_NOTICE };
    }
    throw error;
  }

  const structural = validateGeneratedAnswerProposal(proposal, allowedIds);
  if (!structural.ok) {
    return { answer: deterministicAnswer, answerMode: "deterministic", answerNotice: GROUNDED_ANSWER_FALLBACK_NOTICE };
  }

  let verification;
  try {
    verification = await verifier.verify({ question, selectedItems, proposal: structural.proposal });
  } catch (error) {
    if (error instanceof ReceiverAnswerLayerError) {
      return { answer: deterministicAnswer, answerMode: "deterministic", answerNotice: GROUNDED_ANSWER_FALLBACK_NOTICE };
    }
    throw error;
  }

  if (!validateGroundingVerification(verification, structural.proposal, allowedIds)) {
    return { answer: deterministicAnswer, answerMode: "deterministic", answerNotice: GROUNDED_ANSWER_FALLBACK_NOTICE };
  }

  const body = structural.proposal.sentences.map((sentence) => sentence.text.trim()).join(" ");
  const prefix = buildEpistemicPrefix(question, selectedItems);
  return { answer: `${prefix}${body}`.trim(), answerMode: "generated-grounded" };
}
