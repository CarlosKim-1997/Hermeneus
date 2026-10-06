import type { Pool, PoolClient } from "pg";
import type { DraftHandoff } from "../../handoff/schema.js";
import type { NormalizedConversation } from "../../import/types.js";
import type { CreatorId } from "../../creator/types.js";
import { draftHandoffSchema } from "../../handoff/schema.js";
import type { ImportHandoffRepository } from "../ports.js";
import { lockActiveCreatorMutation } from "./active-creator-mutation.js";

async function insertConversation(client: PoolClient, conversation: NormalizedConversation): Promise<void> {
  await client.query(
    `INSERT INTO source_conversations (id, provider, imported_at) VALUES ($1, $2, $3)`,
    [conversation.id, conversation.source.provider, conversation.source.importedAt],
  );
  for (const [index, message] of conversation.messages.entries()) {
    await client.query(
      `INSERT INTO source_messages
        (id, conversation_id, ordinal, role, content, created_at, source_provider, original_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        message.id,
        conversation.id,
        index,
        message.role,
        message.content,
        message.createdAt ?? null,
        message.source.provider,
        message.source.originalId ?? null,
      ],
    );
  }
}

export class PostgresImportHandoffRepository implements ImportHandoffRepository {
  constructor(private readonly pool: Pool) {}

  async importHandoffAtomic(input: {
    ownerCreatorId: CreatorId;
    conversation: NormalizedConversation;
    handoffId: string;
    draft: DraftHandoff;
  }): Promise<{ revision: number }> {
    const parsedDraft = draftHandoffSchema.parse(input.draft);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockActiveCreatorMutation(client, input.ownerCreatorId);

      await insertConversation(client, input.conversation);
      await client.query(
        `INSERT INTO handoffs (id, source_conversation_id, created_at, owner_creator_id)
         VALUES ($1, $2, NOW(), $3)`,
        [input.handoffId, input.conversation.id, input.ownerCreatorId],
      );
      const inserted = await client.query<{ revision: number }>(
        `INSERT INTO handoff_drafts (handoff_id, revision, snapshot_json, updated_at)
         VALUES ($1, 1, $2::jsonb, NOW())
         RETURNING revision`,
        [parsedDraft.id, JSON.stringify(parsedDraft)],
      );
      await client.query("COMMIT");
      return { revision: inserted.rows[0]!.revision };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
