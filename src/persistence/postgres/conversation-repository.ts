import type { NormalizedConversation } from "../../import/types.js";
import type { ConversationRepository } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly db: Queryable) {}

  async save(conversation: NormalizedConversation): Promise<void> {
    await this.db.query(
      `INSERT INTO source_conversations (id, provider, imported_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET provider = EXCLUDED.provider, imported_at = EXCLUDED.imported_at`,
      [conversation.id, conversation.source.provider, conversation.source.importedAt],
    );

    await this.db.query("DELETE FROM source_messages WHERE conversation_id = $1", [conversation.id]);
    for (const [index, message] of conversation.messages.entries()) {
      await this.db.query(
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

  async get(id: string): Promise<NormalizedConversation | undefined> {
    const conversation = await this.db.query<{
      id: string;
      provider: string;
      imported_at: Date;
    }>("SELECT id, provider, imported_at FROM source_conversations WHERE id = $1", [id]);
    if (conversation.rowCount === 0) return undefined;

    const messages = await this.db.query<{
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
