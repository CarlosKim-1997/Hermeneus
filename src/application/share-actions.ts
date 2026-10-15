"use server";

import { getPool, getRepositories } from "./runtime.js";
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
  loadPublishedViewForShareResolution,
  SHARE_UNAVAILABLE_MESSAGE,
} from "./use-cases/shared-receiver-qa.js";
import { toReceiverFacingError } from "./receiver-errors.js";
import { buildReceiverPacket } from "../portable/receiver-packet.js";
import { verifyExternalAnswer } from "./use-cases/verify-external-answer.js";
import { createOpenAiExternalVerifier, isOpenAiExternalVerifierConfigured } from "../receiver/external/openai-verifier.js";
import { reserveVerifierPilotBudget } from "../receiver/external/pilot-budget.js";
import { requireActiveCreatorPrincipal } from "./creator-action-auth.js";
import { requireOwnedHandoff } from "./authorize-handoff.js";
import {
  CreatorLifecycleBlockedError,
  CreatorUnauthenticatedError,
  HandoffAccessUnavailableError,
} from "./creator-auth-errors.js";

function mapCreatorAuthFailure(error: unknown) {
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

export async function issueShareCapabilityAction(input: { handoffId: string; version: number }) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, input.handoffId);
    const issued = await issueShareCapability(repos, input);
    return {
      ok: true as const,
      capability: issued.metadata,
      token: issued.rawToken,
      sharePath: `/share#${issued.rawToken}`,
    };
  } catch (error) {
    const auth = mapCreatorAuthFailure(error);
    if (auth) return auth;
    if (error instanceof ShareCapabilityError) {
      return { ok: false as const, error: { code: error.code, message: error.message } };
    }
    throw error;
  }
}

export async function listShareCapabilitiesAction(input: { handoffId: string; version: number }) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, input.handoffId);
    const capabilities = await listShareCapabilitiesForVersion(repos, input.handoffId, input.version);
    return { ok: true as const, capabilities };
  } catch (error) {
    const auth = mapCreatorAuthFailure(error);
    if (auth) return auth;
    throw error;
  }
}

export async function revokeShareCapabilityAction(input: { capabilityId: string }) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    const metadata = await repos.shareCapabilities.getMetadataById(input.capabilityId);
    if (!metadata) {
      return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "Share capability was not found." } };
    }
    await requireOwnedHandoff(repos, principal, metadata.handoffId);
    const revoked = await revokeShareCapability(repos, input);
    if (!revoked) {
      return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "Share capability was not found." } };
    }
    return { ok: true as const, capability: revoked };
  } catch (error) {
    const auth = mapCreatorAuthFailure(error);
    if (auth) return auth;
    throw error;
  }
}

export async function loadSharedReceiverViewAction(token: string) {
  const repos = getRepositories();
  return loadSharedReceiverView(repos, token);
}

export async function loadSharedReceiverPacketAction(token: string) {
  const repos = getRepositories();
  const view = await loadPublishedViewForShareResolution(repos, token);
  if (!view) {
    return { ok: false as const, error: { code: "SHARE_UNAVAILABLE" as const, message: SHARE_UNAVAILABLE_MESSAGE } };
  }
  return { ok: true as const, packet: buildReceiverPacket(view) };
}

export async function verifyExternalAnswerAction(input: { token: string; submission: unknown; externalProcessingConsent?: boolean }) {
  const configured = isOpenAiExternalVerifierConfigured();
  if (configured && input.externalProcessingConsent !== true) {
    return { ok: false as const, error: "Confirm external processing for this verification request." };
  }
  const verifier = configured
    ? createOpenAiExternalVerifier(process.env.OPENAI_API_KEY!.trim(), { reserve: () => reserveVerifierPilotBudget(getPool()) })
    : undefined;
  const outcome = await verifyExternalAnswer(getRepositories(), input.token, input.submission, verifier);
  if (outcome.kind === "unavailable") return { ok: false as const, error: SHARE_UNAVAILABLE_MESSAGE };
  if (outcome.kind === "invalid") return { ok: false as const, error: "Submitted packet identity or answer format is invalid." };
  return { ok: true as const, result: outcome.result };
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
