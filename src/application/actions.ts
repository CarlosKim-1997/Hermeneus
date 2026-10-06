"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { toCreatorFacingError } from "./user-errors.js";
import { getRepositories } from "./runtime.js";
import { importAndCreateHandoff } from "./use-cases/import-conversation.js";
import { loadCreatorReview, saveCreatorDraft } from "./use-cases/creator-review.js";
import { deleteWholeHandoff, eraseHandoffSource } from "./use-cases/handoff-erasure.js";
import { loadPublishedHandoff, publishHandoff } from "./use-cases/publish-handoff.js";
import { generateHandoffExtractionProposal } from "./use-cases/generate-extraction-proposal.js";
import { getHandoffExtractor } from "./extraction-factory.js";
import { toExtractionFacingError } from "./extraction-user-errors.js";
import type { HandoffItem } from "../handoff/schema.js";
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

export type ImportConversationFormState = { error: string } | null;

export async function importConversationAction(
  _prev: ImportConversationFormState,
  formData: FormData,
): Promise<ImportConversationFormState> {
  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!transcript) {
    return { error: "Paste a conversation transcript to import." };
  }
  try {
    const principal = await requireActiveCreatorPrincipal();
    const repos = getRepositories();
    const result = await importAndCreateHandoff(repos, principal.creatorId, transcript);
    redirect(`/handoffs/${result.handoffId}/review`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const auth = mapAuthFailure(error);
    if (auth) {
      const message = typeof auth.error === "string" ? auth.error : auth.error.message;
      return { error: message };
    }
    return { error: toCreatorFacingError(error).message };
  }
}

export async function saveDraftAction(input: {
  handoffId: string;
  expectedRevision: number;
  items: HandoffItem[];
}) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, input.handoffId);
    const result = await saveCreatorDraft(repos, input.handoffId, input.items, input.expectedRevision);
    return { ok: true as const, revision: result.revision };
  } catch (error) {
    const auth = mapAuthFailure(error);
    if (auth) return auth;
    return { ok: false as const, error: toCreatorFacingError(error) };
  }
}

export async function publishHandoffAction(handoffId: string, expectedDraftRevision: number) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, handoffId);
    const published = await publishHandoff(repos, handoffId, expectedDraftRevision);
    redirect(`/handoffs/${handoffId}/published/${published.version}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const auth = mapAuthFailure(error);
    if (auth) return auth;
    return { ok: false as const, error: toCreatorFacingError(error) };
  }
}

export async function fetchCreatorReview(handoffId: string) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, handoffId);
    return loadCreatorReview(repos, handoffId);
  } catch (error) {
    if (error instanceof HandoffAccessUnavailableError || error instanceof CreatorUnauthenticatedError) {
      return undefined;
    }
    throw error;
  }
}

export async function fetchPublishedHandoff(handoffId: string, version: number) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, handoffId);
    return loadPublishedHandoff(repos, handoffId, version);
  } catch (error) {
    if (error instanceof HandoffAccessUnavailableError || error instanceof CreatorUnauthenticatedError) {
      return undefined;
    }
    throw error;
  }
}

export async function eraseSourceAction(handoffId: string) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, handoffId);
    const result = await eraseHandoffSource(repos, principal.creatorId, handoffId);
    return { ok: true as const, revision: result.draftRevision, idempotent: result.idempotent };
  } catch (error) {
    const auth = mapAuthFailure(error);
    if (auth) return auth;
    return { ok: false as const, error: toCreatorFacingError(error) };
  }
}

export async function deleteHandoffAction(handoffId: string) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, handoffId);
    await deleteWholeHandoff(repos, principal.creatorId, handoffId);
    redirect("/handoffs");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const auth = mapAuthFailure(error);
    if (auth) return auth;
    return { ok: false as const, error: toCreatorFacingError(error) };
  }
}

export async function generateExtractionSuggestionsAction(handoffId: string) {
  try {
    const repos = getRepositories();
    const principal = await requireActiveCreatorPrincipal();
    await requireOwnedHandoff(repos, principal, handoffId);
    const extractor = getHandoffExtractor();
    const result = await generateHandoffExtractionProposal(repos, extractor, handoffId);
    return { ok: true as const, suggestions: result.suggestions };
  } catch (error) {
    const auth = mapAuthFailure(error);
    if (auth) return auth;
    return { ok: false as const, error: toExtractionFacingError(error) };
  }
}
