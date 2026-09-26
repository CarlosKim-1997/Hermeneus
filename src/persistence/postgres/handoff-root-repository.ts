import type { CreatorId } from "../../creator/types.js";
import { PersistenceConflictError } from "../errors.js";
import type { HandoffRootRepository } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresHandoffRootRepository implements HandoffRootRepository {
  constructor(private readonly db: Queryable) {}

  async create(
    handoffId: string,
    sourceConversationId: string,
    ownerCreatorId: CreatorId,
    createdAt = new Date().toISOString(),
  ): Promise<void> {
    const inserted = await this.db.query<{ id: string }>(
      `INSERT INTO handoffs (id, source_conversation_id, created_at, owner_creator_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [handoffId, sourceConversationId, createdAt, ownerCreatorId],
    );
    if (inserted.rowCount && inserted.rowCount > 0) return;

    const existing = await this.db.query<{ source_conversation_id: string; owner_creator_id: string }>(
      "SELECT source_conversation_id, owner_creator_id FROM handoffs WHERE id = $1",
      [handoffId],
    );
    if (existing.rowCount === 0) {
      throw new Error(`Handoff ${handoffId} conflict without persisted row`);
    }
    const row = existing.rows[0]!;
    if (row.source_conversation_id === sourceConversationId && row.owner_creator_id === ownerCreatorId) {
      return;
    }
    throw new PersistenceConflictError(`Handoff ${handoffId} is already bound to a different conversation or owner`);
  }

  async getSourceConversationId(handoffId: string): Promise<string | undefined> {
    const existing = await this.db.query<{ source_conversation_id: string }>(
      "SELECT source_conversation_id FROM handoffs WHERE id = $1",
      [handoffId],
    );
    if (existing.rowCount === 0) return undefined;
    return existing.rows[0].source_conversation_id;
  }

  async getOwnerCreatorId(handoffId: string): Promise<CreatorId | undefined> {
    const existing = await this.db.query<{ owner_creator_id: string }>(
      "SELECT owner_creator_id FROM handoffs WHERE id = $1",
      [handoffId],
    );
    if (existing.rowCount === 0) return undefined;
    return existing.rows[0].owner_creator_id;
  }
}
