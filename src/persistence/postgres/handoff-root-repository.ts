import type { CreatorHandoffSummary } from "../../handoff/creator-handoff-summary.js";
import type { CreatorId } from "../../creator/types.js";
import type { HandoffSourceState } from "../handoff-source-state.js";
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
    const state = await this.getHandoffSourceState(handoffId);
    return state?.kind === "retained" ? state.conversationId : undefined;
  }

  async getHandoffSourceState(handoffId: string): Promise<HandoffSourceState | undefined> {
    const existing = await this.db.query<{ source_conversation_id: string | null; source_erased_at: Date | null }>(
      "SELECT source_conversation_id, source_erased_at FROM handoffs WHERE id = $1",
      [handoffId],
    );
    if (existing.rowCount === 0) return undefined;
    const row = existing.rows[0]!;
    if (row.source_erased_at) {
      return { kind: "erased", erasedAt: row.source_erased_at.toISOString() };
    }
    if (row.source_conversation_id) {
      return { kind: "retained", conversationId: row.source_conversation_id };
    }
    return undefined;
  }

  async getOwnerCreatorId(handoffId: string): Promise<CreatorId | undefined> {
    const existing = await this.db.query<{ owner_creator_id: string }>(
      "SELECT owner_creator_id FROM handoffs WHERE id = $1",
      [handoffId],
    );
    if (existing.rowCount === 0) return undefined;
    return existing.rows[0].owner_creator_id;
  }

  async listSummariesForOwner(ownerCreatorId: CreatorId): Promise<CreatorHandoffSummary[]> {
    const result = await this.db.query<{
      handoff_id: string;
      created_at: Date;
      draft_revision: number;
      draft_updated_at: Date;
      latest_published_version: number | null;
      latest_published_at: Date | null;
    }>(
      `SELECT
         h.id AS handoff_id,
         h.created_at,
         d.revision AS draft_revision,
         d.updated_at AS draft_updated_at,
         pub.version AS latest_published_version,
         pub.published_at AS latest_published_at
       FROM handoffs h
       INNER JOIN handoff_drafts d ON d.handoff_id = h.id
       LEFT JOIN LATERAL (
         SELECT version, published_at
         FROM published_handoff_versions
         WHERE handoff_id = h.id
         ORDER BY version DESC
         LIMIT 1
       ) pub ON TRUE
       WHERE h.owner_creator_id = $1
       ORDER BY h.created_at DESC, h.id DESC`,
      [ownerCreatorId],
    );

    return result.rows.map((row) => ({
      handoffId: row.handoff_id,
      createdAt: row.created_at.toISOString(),
      draftRevision: row.draft_revision,
      draftUpdatedAt: row.draft_updated_at.toISOString(),
      latestPublishedVersion: row.latest_published_version ?? undefined,
      latestPublishedAt: row.latest_published_at?.toISOString(),
    }));
  }
}
