import { PersistenceConflictError } from "../errors.js";
import type { HandoffRootRepository } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresHandoffRootRepository implements HandoffRootRepository {
  constructor(private readonly db: Queryable) {}

  async create(handoffId: string, sourceConversationId: string, createdAt = new Date().toISOString()): Promise<void> {
    const existing = await this.db.query<{ source_conversation_id: string }>(
      "SELECT source_conversation_id FROM handoffs WHERE id = $1",
      [handoffId],
    );
    if (existing.rowCount === 0) {
      await this.db.query(
        `INSERT INTO handoffs (id, source_conversation_id, created_at)
         VALUES ($1, $2, $3)`,
        [handoffId, sourceConversationId, createdAt],
      );
      return;
    }
    if (existing.rows[0].source_conversation_id === sourceConversationId) return;
    throw new PersistenceConflictError(
      `Handoff ${handoffId} is already bound to conversation ${existing.rows[0].source_conversation_id}`,
    );
  }
}
