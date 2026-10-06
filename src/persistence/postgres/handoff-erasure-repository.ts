import type { Pool, PoolClient } from "pg";
import { draftHandoffSchema, type DraftHandoff } from "../../handoff/schema.js";
import type { CreatorId } from "../../creator/types.js";
import { HandoffLifecycleUnavailableError } from "../errors.js";
import type { HandoffSourceState } from "../handoff-source-state.js";
import { lockActiveCreatorMutation } from "./active-creator-mutation.js";

export type SourceErasureResult = {
  handoffId: string;
  sourceState: HandoffSourceState;
  draftRevision: number;
  idempotent: boolean;
};

async function assertOwnerLocked(
  client: PoolClient,
  handoffId: string,
  ownerCreatorId: CreatorId,
): Promise<{ source_conversation_id: string | null; source_erased_at: Date | null }> {
  const handoff = await client.query<{
    owner_creator_id: string;
    source_conversation_id: string | null;
    source_erased_at: Date | null;
  }>(`SELECT owner_creator_id, source_conversation_id, source_erased_at FROM handoffs WHERE id = $1 FOR UPDATE`, [
    handoffId,
  ]);
  if (handoff.rowCount === 0 || handoff.rows[0]!.owner_creator_id !== ownerCreatorId) {
    throw new HandoffLifecycleUnavailableError(`Handoff ${handoffId} is unavailable`);
  }
  return handoff.rows[0]!;
}

async function deleteSourceConversationIfUnreferenced(client: PoolClient, sourceConversationId: string): Promise<void> {
  const retained = await client.query(
    `SELECT 1 FROM handoffs WHERE source_conversation_id = $1 LIMIT 1`,
    [sourceConversationId],
  );
  if (retained.rowCount === 0) {
    await client.query(`DELETE FROM source_conversations WHERE id = $1`, [sourceConversationId]);
  }
}

function stripDraftProvenance(draft: DraftHandoff): DraftHandoff {
  return draftHandoffSchema.parse({
    id: draft.id,
    items: draft.items.map(({ id, type, statement, priority, createdBy }) => ({
      id,
      type,
      statement,
      priority,
      createdBy,
      sources: [],
    })),
  });
}

export class PostgresHandoffErasureRepository {
  constructor(private readonly pool: Pool) {}

  async eraseSource(handoffId: string, ownerCreatorId: CreatorId, erasedAt: string): Promise<SourceErasureResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockActiveCreatorMutation(client, ownerCreatorId);
      const row = await assertOwnerLocked(client, handoffId, ownerCreatorId);

      if (row.source_erased_at !== null && row.source_conversation_id === null) {
        const draftRevision = await client.query<{ revision: number }>(
          `SELECT revision FROM handoff_drafts WHERE handoff_id = $1`,
          [handoffId],
        );
        await client.query("COMMIT");
        return {
          handoffId,
          sourceState: { kind: "erased", erasedAt: row.source_erased_at.toISOString() },
          draftRevision: draftRevision.rows[0]?.revision ?? 0,
          idempotent: true,
        };
      }

      const sourceConversationId = row.source_conversation_id;
      if (!sourceConversationId) {
        throw new HandoffLifecycleUnavailableError(`Handoff ${handoffId} has invalid source lifecycle state`);
      }

      await client.query(`SELECT id FROM source_conversations WHERE id = $1 FOR UPDATE`, [sourceConversationId]);

      const draftRow = await client.query<{ revision: number; snapshot_json: unknown }>(
        `SELECT revision, snapshot_json FROM handoff_drafts WHERE handoff_id = $1 FOR UPDATE`,
        [handoffId],
      );
      if (draftRow.rowCount === 0) {
        throw new HandoffLifecycleUnavailableError(`Handoff ${handoffId} draft is unavailable`);
      }
      const draft = stripDraftProvenance(draftHandoffSchema.parse(draftRow.rows[0]!.snapshot_json));
      const nextRevision = draftRow.rows[0]!.revision + 1;

      await client.query(
        `UPDATE handoff_drafts
         SET revision = $2, snapshot_json = $3::jsonb, updated_at = NOW()
         WHERE handoff_id = $1`,
        [handoffId, nextRevision, JSON.stringify(draft)],
      );

      await client.query(`DELETE FROM published_handoff_provenance WHERE handoff_id = $1`, [handoffId]);

      await client.query(
        `UPDATE handoffs
         SET source_conversation_id = NULL, source_erased_at = $2
         WHERE id = $1`,
        [handoffId, erasedAt],
      );

      await deleteSourceConversationIfUnreferenced(client, sourceConversationId);

      await client.query("COMMIT");
      return {
        handoffId,
        sourceState: { kind: "erased", erasedAt },
        draftRevision: nextRevision,
        idempotent: false,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteHandoff(handoffId: string, ownerCreatorId: CreatorId): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockActiveCreatorMutation(client, ownerCreatorId);
      const row = await assertOwnerLocked(client, handoffId, ownerCreatorId);
      const sourceConversationId = row.source_conversation_id;

      if (sourceConversationId) {
        await client.query(`SELECT id FROM source_conversations WHERE id = $1 FOR UPDATE`, [sourceConversationId]);
      }

      await client.query(`DELETE FROM share_capabilities WHERE handoff_id = $1`, [handoffId]);
      await client.query(`DELETE FROM published_handoff_provenance WHERE handoff_id = $1`, [handoffId]);
      await client.query(`DELETE FROM published_handoff_versions WHERE handoff_id = $1`, [handoffId]);
      await client.query(`DELETE FROM handoff_drafts WHERE handoff_id = $1`, [handoffId]);
      await client.query(`DELETE FROM handoffs WHERE id = $1`, [handoffId]);

      if (sourceConversationId) {
        await deleteSourceConversationIfUnreferenced(client, sourceConversationId);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
