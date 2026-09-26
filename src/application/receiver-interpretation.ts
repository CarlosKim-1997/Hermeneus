import {
  interpretDeterministicDerived,
  interpretPublished,
  type Interpretation,
} from "../receiver/interpret.js";
import type { InterpretationAuthority } from "../receiver/interpretation-authority.js";
import { ReceiverSemanticError } from "../receiver/semantic/errors.js";
import { renderInterpretationAnswer } from "../receiver/semantic/render-answer.js";
import { validateInterpretationProposal } from "../receiver/semantic/validate-proposal.js";
import type { ReceiverSemanticInterpreter } from "../receiver/semantic/interpreter.js";

export const SEMANTIC_FALLBACK_NOTICE =
  "Semantic interpretation was unavailable; deterministic interpretation was used.";

export type ReceiverInterpretationResult = Interpretation & {
  interpretationMode: "deterministic" | "semantic";
  interpretationNotice?: string;
};

/**
 * Fallback policy when live semantic output is invalid or the provider fails:
 * 1. Prefer full deterministic interpretPublished when it yields SUPPORTED, DERIVED, or OPEN.
 * 2. Otherwise return deterministic UNKNOWN.
 */
export function fallbackDeterministicInterpretation(
  question: string,
  authority: InterpretationAuthority,
  notice?: string,
): ReceiverInterpretationResult {
  const fallback = interpretPublished(question, authority);
  if (fallback.classification === "SUPPORTED" || fallback.classification === "DERIVED" || fallback.classification === "OPEN") {
    return { ...fallback, interpretationMode: "deterministic", interpretationNotice: notice };
  }
  return { ...fallback, interpretationMode: "deterministic", interpretationNotice: notice };
}

export async function interpretReceiverQuestion(
  question: string,
  authority: InterpretationAuthority,
  semanticInterpreter: ReceiverSemanticInterpreter | null,
): Promise<ReceiverInterpretationResult> {
  const trimmed = question.trim();

  const derived = interpretDeterministicDerived(trimmed, authority);
  if (derived) {
    return { ...derived, interpretationMode: "deterministic" };
  }

  if (!semanticInterpreter) {
    return { ...interpretPublished(trimmed, authority), interpretationMode: "deterministic" };
  }

  let proposal;
  try {
    proposal = await semanticInterpreter.interpret({ question: trimmed, items: authority.items });
  } catch (error) {
    if (error instanceof ReceiverSemanticError) {
      return fallbackDeterministicInterpretation(trimmed, authority, SEMANTIC_FALLBACK_NOTICE);
    }
    throw error;
  }

  const validated = validateInterpretationProposal(proposal, authority.items);
  if (!validated.ok) {
    return fallbackDeterministicInterpretation(trimmed, authority, SEMANTIC_FALLBACK_NOTICE);
  }

  const rendered = renderInterpretationAnswer(
    validated.proposal.classification,
    validated.proposal.citationIds,
    authority.items,
    trimmed,
  );
  return { ...rendered, interpretationMode: "semantic" };
}
