import type { HandoffRootRepository } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresHandoffRootRepository implements HandoffRootRepository {
  constructor(private readonly db: Queryable) {}

  async create(handoffId: string, sourceConversationId: string, createdAt = new Date().toISOString()): Promise<void> {
    await this.db.query(
      `INSERT INTO handoffs (id, source_conversation_id, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [handoffId, sourceConversationId, createdAt],
    );
  }
}
