import type { Pool } from "pg";
import { conversationsEqual } from "../conversation-equality.js";
import { PersistenceConflictError } from "../errors.js";
import type { ConversationRepository } from "../ports.js";
import type { NormalizedConversation } from "../../import/types.js";

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly pool: Pool) {}

  async create(conversation: NormalizedConversation): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO source_conversations (id, provider, imported_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [conversation.id, conversation.source.provider, conversation.source.importedAt],
      );

      if (inserted.rowCount && inserted.rowCount > 0) {
        await this.insertMessages(client, conversation);
        await client.query("COMMIT");
        return;
      }

      const loaded = await this.loadConversation(client, conversation.id);
      if (!loaded) {
        throw new Error(`Conversation ${conversation.id} conflict without persisted row`);
      }
      if (!conversationsEqual(loaded, conversation)) {
        throw new PersistenceConflictError(
          `Conversation ${conversation.id} already exists with different normalized content`,
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async get(id: string): Promise<NormalizedConversation | undefined> {
    const client = await this.pool.connect();
    try {
      return await this.loadConversation(client, id);
    } finally {
      client.release();
    }
  }

  private async insertMessages(client: Queryable, conversation: NormalizedConversation): Promise<void> {
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

  private async loadConversation(client: Queryable, id: string): Promise<NormalizedConversation | undefined> {
    const conversation = await client.query<{
      id: string;
      provider: string;
      imported_at: Date;
    }>("SELECT id, provider, imported_at FROM source_conversations WHERE id = $1", [id]);
    if (conversation.rowCount === 0) return undefined;

    const messages = await client.query<{
      id: string;
      role: "creator" | "assistant" | "other";
      content: string;
      created_at: Date | null;
      source_provider: string;
      original_id: string | null;
    }>(
      `SELECT id, role, content, created_at, source_provider, original_id
       FROM source_messages
       WHERE conversation_id = $1
       ORDER BY ordinal ASC`,
      [id],
    );

    const row = conversation.rows[0];
    return {
      id: row.id,
      source: {
        provider: row.provider,
        importedAt: row.imported_at.toISOString(),
      },
      messages: messages.rows.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at?.toISOString(),
        source: {
          provider: message.source_provider,
          originalId: message.original_id ?? undefined,
        },
      })),
    };
  }
}

type Queryable = {
  query: Pool["query"];
};
