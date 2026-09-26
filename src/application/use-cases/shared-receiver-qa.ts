import type { ProvenanceBundle, PublishedReceiverView } from "../../persistence/receiver-types.js";
import { toSharedProvenanceBundle, toSharedReceiverView, type SharedProvenanceBundle, type SharedReceiverView } from "../../persistence/share-types.js";
import type { getRepositories } from "../runtime.js";
import { askReceiverQuestion, fetchReceiverProvenance, type ReceiverAnswer } from "./receiver-qa.js";
import { resolveActiveShareTarget } from "./share-capability.js";

type Repos = ReturnType<typeof getRepositories>;

export const SHARE_UNAVAILABLE_MESSAGE = "This share link is unavailable.";

export async function loadSharedReceiverView(repos: Repos, rawToken: string): Promise<SharedReceiverView | undefined> {
  const target = await resolveActiveShareTarget(repos, rawToken);
  if (!target) return undefined;
  const view = await repos.receiver.getPublishedView(target.handoffId, target.version);
  if (!view) return undefined;
  return toSharedReceiverView(view);
}

async function resolveTargetOrThrowUnavailable(repos: Repos, rawToken: string) {
  const target = await resolveActiveShareTarget(repos, rawToken);
  if (!target) return undefined;
  return target;
}

export async function askSharedReceiverQuestion(
  repos: Repos,
  input: { token: string; question: string },
): Promise<{ kind: "unavailable" } | { kind: "answer"; answer: ReceiverAnswer }> {
  const target = await resolveTargetOrThrowUnavailable(repos, input.token);
  if (!target) return { kind: "unavailable" };

  const answer = await askReceiverQuestion(repos, {
    handoffId: target.handoffId,
    version: target.version,
    question: input.question,
  });
  if (!answer) return { kind: "unavailable" };
  return { kind: "answer", answer };
}

export async function fetchSharedReceiverProvenance(
  repos: Repos,
  input: { token: string; itemIds: string[] },
): Promise<{ kind: "unavailable" } | { kind: "provenance"; provenance: SharedProvenanceBundle }> {
  const target = await resolveTargetOrThrowUnavailable(repos, input.token);
  if (!target) return { kind: "unavailable" };

  const bundle = await fetchReceiverProvenance(repos, {
    handoffId: target.handoffId,
    version: target.version,
    itemIds: input.itemIds,
  });
  if (!bundle) return { kind: "unavailable" };
  return { kind: "provenance", provenance: stripProvenanceForShare(bundle) };
}

export function stripProvenanceForShare(bundle: ProvenanceBundle): SharedProvenanceBundle {
  return toSharedProvenanceBundle(bundle);
}

export async function loadPublishedViewForShareResolution(
  repos: Repos,
  rawToken: string,
): Promise<PublishedReceiverView | undefined> {
  const target = await resolveActiveShareTarget(repos, rawToken);
  if (!target) return undefined;
  return repos.receiver.getPublishedView(target.handoffId, target.version);
}
