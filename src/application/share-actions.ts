"use server";

import { getRepositories } from "./runtime.js";
import {
  issueShareCapability,
  listShareCapabilitiesForVersion,
  revokeShareCapability,
  ShareCapabilityError,
} from "./use-cases/share-capability.js";
import {
  askSharedReceiverQuestion,
  fetchSharedReceiverProvenance,
  loadSharedReceiverView,
  SHARE_UNAVAILABLE_MESSAGE,
} from "./use-cases/shared-receiver-qa.js";
import { toReceiverFacingError } from "./receiver-errors.js";

export async function issueShareCapabilityAction(input: { handoffId: string; version: number }) {
  try {
    const repos = getRepositories();
    const issued = await issueShareCapability(repos, input);
    return {
      ok: true as const,
      capability: issued.metadata,
      token: issued.rawToken,
      sharePath: `/share/${issued.rawToken}`,
    };
  } catch (error) {
    if (error instanceof ShareCapabilityError) {
      return { ok: false as const, error: { code: error.code, message: error.message } };
    }
    throw error;
  }
}

export async function listShareCapabilitiesAction(input: { handoffId: string; version: number }) {
  const repos = getRepositories();
  const capabilities = await listShareCapabilitiesForVersion(repos, input.handoffId, input.version);
  return { ok: true as const, capabilities };
}

export async function revokeShareCapabilityAction(input: { capabilityId: string }) {
  const repos = getRepositories();
  const revoked = await revokeShareCapability(repos, input);
  if (!revoked) {
    return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "Share capability was not found." } };
  }
  return { ok: true as const, capability: revoked };
}

export async function loadSharedReceiverViewAction(token: string) {
  const repos = getRepositories();
  return loadSharedReceiverView(repos, token);
}

export async function askSharedReceiverQuestionAction(input: { token: string; question: string }) {
  if (!input.token.trim()) {
    return { ok: false as const, error: { code: "SHARE_UNAVAILABLE" as const, message: SHARE_UNAVAILABLE_MESSAGE } };
  }
  const question = input.question.trim();
  if (!question) {
    return { ok: false as const, error: { code: "INVALID_INPUT" as const, message: "Enter a question about this Handoff." } };
  }
  try {
    const repos = getRepositories();
    const outcome = await askSharedReceiverQuestion(repos, { token: input.token, question });
    if (outcome.kind === "unavailable") {
      return { ok: false as const, error: { code: "SHARE_UNAVAILABLE" as const, message: SHARE_UNAVAILABLE_MESSAGE } };
    }
    return { ok: true as const, answer: outcome.answer };
  } catch (error) {
    return { ok: false as const, error: toReceiverFacingError(error) };
  }
}

export async function fetchSharedReceiverProvenanceAction(input: { token: string; itemIds: string[] }) {
  if (!input.token.trim()) {
    return { ok: false as const, error: { code: "SHARE_UNAVAILABLE" as const, message: SHARE_UNAVAILABLE_MESSAGE } };
  }
  try {
    const repos = getRepositories();
    const outcome = await fetchSharedReceiverProvenance(repos, input);
    if (outcome.kind === "unavailable") {
      return { ok: false as const, error: { code: "SHARE_UNAVAILABLE" as const, message: SHARE_UNAVAILABLE_MESSAGE } };
    }
    return { ok: true as const, provenance: outcome.provenance };
  } catch (error) {
    return { ok: false as const, error: toReceiverFacingError(error) };
  }
}
