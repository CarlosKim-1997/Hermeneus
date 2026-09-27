import type { DraftHandoff, PublishedHandoff } from "../handoff/schema.js";
import type { NormalizedConversation } from "../import/types.js";
import type { CreatorId } from "../creator/types.js";
import type { ShareCapabilityMetadata, ShareCapabilityTarget } from "../share/types.js";
import type { ProvenanceBundle, PublishedReceiverView } from "./receiver-types.js";

export type DraftSaveResult = {
  revision: number;
};

export interface ConversationRepository {
  create(conversation: NormalizedConversation): Promise<void>;
  get(id: string): Promise<NormalizedConversation | undefined>;
}

export interface DraftRepository {
  save(draft: DraftHandoff, expectedRevision?: number): Promise<DraftSaveResult>;
  get(handoffId: string): Promise<DraftHandoff | undefined>;
  getRevision(handoffId: string): Promise<number | undefined>;
}

export interface PublishedHandoffRepository {
  publish(handoffId: string, publishedAt: string, expectedDraftRevision: number): Promise<PublishedHandoff>;
  get(handoffId: string, version: number): Promise<PublishedHandoff | undefined>;
  listVersions(handoffId: string): Promise<Array<{ version: number; publishedAt: string }>>;
}

export interface CreatorRepository {
  ensure(input: { id: CreatorId; createdAt: string }): Promise<void>;
  exists(id: CreatorId): Promise<boolean>;
}

export interface ExternalIdentityRepository {
  resolve(provider: string, subject: string): Promise<CreatorId | undefined>;
  resolveOrCreate(input: {
    provider: string;
    subject: string;
    candidateCreatorId: CreatorId;
    createdAt: string;
  }): Promise<CreatorId>;
}

export interface HandoffRootRepository {
  create(handoffId: string, sourceConversationId: string, ownerCreatorId: CreatorId, createdAt?: string): Promise<void>;
  getSourceConversationId(handoffId: string): Promise<string | undefined>;
  getOwnerCreatorId(handoffId: string): Promise<CreatorId | undefined>;
}

export interface ReceiverReadRepository {
  getPublishedView(handoffId: string, version: number): Promise<PublishedReceiverView | undefined>;
  getProvenance(handoffId: string, version: number, itemIds: string[]): Promise<ProvenanceBundle>;
}

export interface ShareCapabilityRepository {
  create(input: {
    id: string;
    handoffId: string;
    version: number;
    tokenHash: string;
    createdAt: string;
  }): Promise<ShareCapabilityMetadata>;

  resolveActiveByTokenHash(tokenHash: string): Promise<ShareCapabilityTarget | undefined>;

  listForPublishedVersion(handoffId: string, version: number): Promise<ShareCapabilityMetadata[]>;

  revoke(capabilityId: string, revokedAt: string): Promise<ShareCapabilityMetadata | undefined>;

  getMetadataById(capabilityId: string): Promise<ShareCapabilityMetadata | undefined>;
}
