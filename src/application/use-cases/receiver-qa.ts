import { authorityFromReceiverView } from "../../receiver/interpretation-authority.js";
import { interpretPublished, type Answerability } from "../../receiver/interpret.js";
import type { HandoffItemType, HandoffPriority } from "../../handoff/schema.js";
import type { ProvenanceBundle, PublishedReceiverView } from "../../persistence/receiver-types.js";
import { ReceiverIntegrityError } from "../receiver-errors.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export type ReceiverCitedItem = {
  id: string;
  type: HandoffItemType;
  statement: string;
  priority: HandoffPriority;
};

export type ReceiverAnswer = {
  classification: Answerability;
  answer: string;
  citedItems: ReceiverCitedItem[];
};

export async function loadReceiverPublishedView(
  repos: Repos,
  handoffId: string,
  version: number,
): Promise<PublishedReceiverView | undefined> {
  return repos.receiver.getPublishedView(handoffId, version);
}

export async function askReceiverQuestion(
  repos: Repos,
  input: { handoffId: string; version: number; question: string },
): Promise<ReceiverAnswer | undefined> {
  const view = await repos.receiver.getPublishedView(input.handoffId, input.version);
  if (!view) return undefined;

  const authority = authorityFromReceiverView(view);
  const interpretation = interpretPublished(input.question.trim(), authority);
  const citedItems = resolveCitedItems(view, interpretation.citations);

  return {
    classification: interpretation.classification,
    answer: interpretation.answer,
    citedItems,
  };
}

export async function fetchReceiverProvenance(
  repos: Repos,
  input: { handoffId: string; version: number; itemIds: string[] },
): Promise<ProvenanceBundle | undefined> {
  const view = await repos.receiver.getPublishedView(input.handoffId, input.version);
  if (!view) return undefined;
  const uniqueIds = [...new Set(input.itemIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { handoffId: input.handoffId, version: input.version, items: [] };
  }
  return repos.receiver.getProvenance(input.handoffId, input.version, uniqueIds);
}

function resolveCitedItems(view: PublishedReceiverView, citationIds: string[]): ReceiverCitedItem[] {
  const resolved: ReceiverCitedItem[] = [];
  for (const id of citationIds) {
    const item = view.items.find((candidate) => candidate.id === id);
    if (!item) {
      throw new ReceiverIntegrityError(`Interpretation cited missing item ${id} on ${view.handoffId} v${view.version}`);
    }
    resolved.push(item);
  }
  return resolved;
}
