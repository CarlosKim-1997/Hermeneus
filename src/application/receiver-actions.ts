"use server";

import { getRepositories } from "./runtime.js";
import {
  askReceiverQuestion,
  fetchReceiverProvenance,
  loadReceiverPublishedView,
} from "./use-cases/receiver-qa.js";
import { toReceiverFacingError } from "./receiver-errors.js";
import { requireActiveCreatorPrincipal } from "./creator-action-auth.js";
import { requireOwnedHandoff } from "./authorize-handoff.js";
import {
  CreatorLifecycleBlockedError,
  CreatorUnauthenticatedError,
  HandoffAccessUnavailableError,
} from "./creator-auth-errors.js";

function mapAuthFailure(error: unknown) {
  if (error instanceof CreatorUnauthenticatedError) {
    return { ok: false as const, error: { code: "UNAUTHENTICATED" as const, message: "Sign in to continue." } };
  }
  if (error instanceof HandoffAccessUnavailableError) {
    return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "This Handoff is unavailable." } };
  }
  if (error instanceof CreatorLifecycleBlockedError) {
    return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "This Handoff is unavailable." } };
  }
  return null;
}

export async function fetchReceiverPublishedViewAction(handoffId: string, version: number) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, handoffId);
    return loadReceiverPublishedView(repos, handoffId, version);
  } catch (error) {
    if (
      error instanceof HandoffAccessUnavailableError ||
      error instanceof CreatorUnauthenticatedError ||
      error instanceof CreatorLifecycleBlockedError
    ) {
      return undefined;
    }
    throw error;
  }
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
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, input.handoffId);
    const answer = await askReceiverQuestion(repos, { ...input, question });
    if (!answer) {
      return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "This Handoff version was not found." } };
    }
    return { ok: true as const, answer };
  } catch (error) {
    const auth = mapAuthFailure(error);
    if (auth) return auth;
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
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, input.handoffId);
    const bundle = await fetchReceiverProvenance(repos, input);
    if (!bundle) {
      return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "This Handoff version was not found." } };
    }
    return { ok: true as const, provenance: bundle };
  } catch (error) {
    const auth = mapAuthFailure(error);
    if (auth) return auth;
    return { ok: false as const, error: toReceiverFacingError(error) };
  }
}
