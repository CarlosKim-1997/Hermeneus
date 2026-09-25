import type { Pool } from "pg";
import { PostgresConversationRepository } from "./conversation-repository.js";
import { PostgresDraftRepository } from "./draft-repository.js";
import { PostgresHandoffRootRepository } from "./handoff-root-repository.js";
import { PostgresPublishedHandoffRepository } from "./published-handoff-repository.js";
import { PostgresReceiverReadRepository } from "./receiver-read-repository.js";

export function createPostgresRepositories(pool: Pool) {
  return {
    conversations: new PostgresConversationRepository(pool),
    drafts: new PostgresDraftRepository(pool),
    handoffs: new PostgresHandoffRootRepository(pool),
    published: new PostgresPublishedHandoffRepository(pool),
    receiver: new PostgresReceiverReadRepository(pool),
  };
}
