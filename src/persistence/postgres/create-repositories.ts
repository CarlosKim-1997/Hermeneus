import type { Pool } from "pg";
import { PostgresCreatorRepository } from "./creator-repository.js";
import { PostgresExternalIdentityRepository } from "./external-identity-repository.js";
import { PostgresConversationRepository } from "./conversation-repository.js";
import { PostgresDraftRepository } from "./draft-repository.js";
import { PostgresHandoffRootRepository } from "./handoff-root-repository.js";
import { PostgresPublishedHandoffRepository } from "./published-handoff-repository.js";
import { PostgresReceiverReadRepository } from "./receiver-read-repository.js";
import { PostgresShareCapabilityRepository } from "./share-capability-repository.js";
import { PostgresHandoffErasureRepository } from "./handoff-erasure-repository.js";
import { PostgresImportHandoffRepository } from "./import-handoff-repository.js";
import { PostgresAccountErasureRepository } from "./account-erasure-repository.js";

export function createPostgresRepositories(pool: Pool) {
  const creators = new PostgresCreatorRepository(pool);
  return {
    creators,
    importHandoff: new PostgresImportHandoffRepository(pool),
    accountErasure: new PostgresAccountErasureRepository(pool),
    externalIdentities: new PostgresExternalIdentityRepository(pool),
    conversations: new PostgresConversationRepository(pool),
    drafts: new PostgresDraftRepository(pool),
    handoffs: new PostgresHandoffRootRepository(pool),
    published: new PostgresPublishedHandoffRepository(pool),
    receiver: new PostgresReceiverReadRepository(pool),
    shareCapabilities: new PostgresShareCapabilityRepository(pool),
    erasure: new PostgresHandoffErasureRepository(pool),
  };
}
