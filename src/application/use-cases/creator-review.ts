import { createDraft } from "../../handoff/draft.js";
import { draftHandoffSchema, handoffItemSchema, type HandoffItem } from "../../handoff/schema.js";
import { CreatorSourceRead } from "../creator-source-read.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export type CreatorReviewState = {
  handoffId: string;
  conversationId: string;
  revision: number;
  draft: ReturnType<typeof draftHandoffSchema.parse>;
  sourceConversation: NonNullable<Awaited<ReturnType<CreatorSourceRead["getSourceConversation"]>>>;
};

export async function loadCreatorReview(repos: Repos, handoffId: string): Promise<CreatorReviewState | undefined> {
  const conversationId = await repos.handoffs.getSourceConversationId(handoffId);
  if (!conversationId) return undefined;

  const draft = await repos.drafts.get(handoffId);
  const revision = await repos.drafts.getRevision(handoffId);
  if (!draft || revision === undefined) return undefined;

  const sourceRead = new CreatorSourceRead(repos.conversations);
  const sourceConversation = await sourceRead.getSourceConversation(conversationId);
  if (!sourceConversation) return undefined;

  return { handoffId, conversationId, revision, draft, sourceConversation };
}

function sourcesEqual(
  left: HandoffItem["sources"],
  right: HandoffItem["sources"],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveCreatedBy(
  incoming: HandoffItem,
  previous: HandoffItem | undefined,
): HandoffItem["createdBy"] {
  if (!previous) return incoming.createdBy === "EXTRACTION" ? "EXTRACTION" : "CREATOR";
  if (previous.createdBy !== "EXTRACTION") return "CREATOR";
  const unchanged =
    previous.statement === incoming.statement &&
    previous.type === incoming.type &&
    previous.priority === incoming.priority &&
    sourcesEqual(previous.sources, incoming.sources);
  return unchanged ? "EXTRACTION" : "CREATOR";
}

export async function saveCreatorDraft(
  repos: Repos,
  handoffId: string,
  items: HandoffItem[],
  expectedRevision: number,
) {
  const previousDraft = await repos.drafts.get(handoffId);
  const previousById = new Map(previousDraft?.items.map((item) => [item.id, item]) ?? []);

  const parsedItems = items.map((item) => {
    const parsed = handoffItemSchema.parse(item);
    const createdBy = resolveCreatedBy(parsed, previousById.get(parsed.id));
    return handoffItemSchema.parse({ ...parsed, createdBy });
  });

  return repos.drafts.save(createDraft(handoffId, parsedItems), expectedRevision);
}
