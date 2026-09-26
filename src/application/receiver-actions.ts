"use server";

import { getRepositories } from "./runtime.js";
import {
  askReceiverQuestion,
  fetchReceiverProvenance,
  loadReceiverPublishedView,
} from "./use-cases/receiver-qa.js";
import { toReceiverFacingError } from "./receiver-errors.js";

export async function fetchReceiverPublishedViewAction(handoffId: string, version: number) {
  const repos = getRepositories();
  return loadReceiverPublishedView(repos, handoffId, version);
}

export async function askReceiverQuestionAction(input: {
  handoffId: string;
  version: number;
  question: string;
}) {
  const question = input.question.trim();
  if (!question) {
    return { ok: false as const, error: { code: "INVALID_INPUT" as const, message: "Enter a question about this Handoff." } };
  }
  try {
    const repos = getRepositories();
    const answer = await askReceiverQuestion(repos, { ...input, question });
    if (!answer) {
      return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "This Handoff version was not found." } };
    }
    return { ok: true as const, answer };
  } catch (error) {
    return { ok: false as const, error: toReceiverFacingError(error) };
  }
}

export async function fetchReceiverProvenanceAction(input: {
  handoffId: string;
  version: number;
  itemIds: string[];
}) {
  try {
    const repos = getRepositories();
    const bundle = await fetchReceiverProvenance(repos, input);
    if (!bundle) {
      return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "This Handoff version was not found." } };
    }
    return { ok: true as const, provenance: bundle };
  } catch (error) {
    return { ok: false as const, error: toReceiverFacingError(error) };
  }
}
