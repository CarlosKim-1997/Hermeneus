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

export async function saveCreatorDraft(
  repos: Repos,
  handoffId: string,
  items: HandoffItem[],
  expectedRevision: number,
) {
  const parsedItems = items.map((item) => handoffItemSchema.parse({ ...item, createdBy: "CREATOR" }));
  return repos.drafts.save(createDraft(handoffId, parsedItems), expectedRevision);
}
