import type { DraftHandoff, PublishedHandoff } from "../handoff/schema.js";
import type { NormalizedConversation } from "../import/types.js";
import type { ProvenanceBundle, PublishedReceiverView } from "./receiver-types.js";

export interface ConversationRepository {
  save(conversation: NormalizedConversation): Promise<void>;
  get(id: string): Promise<NormalizedConversation | undefined>;
}

export interface DraftRepository {
  save(draft: DraftHandoff): Promise<void>;
  get(handoffId: string): Promise<DraftHandoff | undefined>;
}

export interface PublishedHandoffRepository {
  publish(handoffId: string, publishedAt: string): Promise<PublishedHandoff>;
  get(handoffId: string, version: number): Promise<PublishedHandoff | undefined>;
  listVersions(handoffId: string): Promise<Array<{ version: number; publishedAt: string }>>;
}

export interface HandoffRootRepository {
  create(handoffId: string, sourceConversationId: string, createdAt?: string): Promise<void>;
}

export interface ReceiverReadRepository {
  getPublishedView(handoffId: string, version: number): Promise<PublishedReceiverView | undefined>;
  getProvenance(handoffId: string, version: number, itemIds: string[]): Promise<ProvenanceBundle>;
}
