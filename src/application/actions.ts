"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { toCreatorFacingError } from "./user-errors.js";
import { getRepositories } from "./runtime.js";
import { importAndCreateHandoff } from "./use-cases/import-conversation.js";
import { loadCreatorReview, saveCreatorDraft } from "./use-cases/creator-review.js";
import { loadPublishedHandoff, publishHandoff } from "./use-cases/publish-handoff.js";
import type { HandoffItem } from "../handoff/schema.js";

export async function importConversationAction(formData: FormData) {
  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!transcript) {
    return { ok: false as const, error: "Paste a conversation transcript to import." };
  }
  try {
    const repos = getRepositories();
    const result = await importAndCreateHandoff(repos, transcript);
    redirect(`/handoffs/${result.handoffId}/review`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false as const, error: toCreatorFacingError(error).message };
  }
}

export async function saveDraftAction(input: {
  handoffId: string;
  expectedRevision: number;
  items: HandoffItem[];
}) {
  try {
    const repos = getRepositories();
    const result = await saveCreatorDraft(repos, input.handoffId, input.items, input.expectedRevision);
    return { ok: true as const, revision: result.revision };
  } catch (error) {
    return { ok: false as const, error: toCreatorFacingError(error) };
  }
}

export async function publishHandoffAction(handoffId: string, expectedDraftRevision: number) {
  try {
    const repos = getRepositories();
    const published = await publishHandoff(repos, handoffId, expectedDraftRevision);
    redirect(`/handoffs/${handoffId}/published/${published.version}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { ok: false as const, error: toCreatorFacingError(error) };
  }
}

export async function fetchCreatorReview(handoffId: string) {
  const repos = getRepositories();
  return loadCreatorReview(repos, handoffId);
}

export async function fetchPublishedHandoff(handoffId: string, version: number) {
  const repos = getRepositories();
  return loadPublishedHandoff(repos, handoffId, version);
}
