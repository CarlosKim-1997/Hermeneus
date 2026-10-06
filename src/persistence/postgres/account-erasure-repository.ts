import type { Pool, PoolClient } from "pg";
import type { CreatorId } from "../../creator/types.js";
import { CreatorLifecycleUnavailableError } from "../errors.js";
import type { AccountErasureRepository } from "../ports.js";
import { acquireCreatorExclusiveXactLock } from "./creator-lifecycle-lock.js";

async function deleteSourceConversationIfUnreferenced(client: PoolClient, sourceConversationId: string): Promise<void> {
  const retained = await client.query(
    `SELECT 1 FROM handoffs WHERE source_conversation_id = $1 LIMIT 1`,
    [sourceConversationId],
  );
  if (retained.rowCount === 0) {
    await client.query(`DELETE FROM source_conversations WHERE id = $1`, [sourceConversationId]);
  }
}

export class PostgresAccountErasureRepository implements AccountErasureRepository {
  constructor(private readonly pool: Pool) {}

  async enterErasingPhase(creatorId: CreatorId): Promise<{ alreadyErasing: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await acquireCreatorExclusiveXactLock(client, creatorId);
      const row = await client.query<{ lifecycle_status: string }>(
        `SELECT lifecycle_status FROM creators WHERE id = $1 FOR UPDATE`,
        [creatorId],
      );
      if (row.rowCount === 0) {
        throw new CreatorLifecycleUnavailableError(`Creator ${creatorId} is unavailable`);
      }
      const status = row.rows[0]!.lifecycle_status;
      if (status === "erasing") {
        await client.query("COMMIT");
        return { alreadyErasing: true };
      }
      if (status !== "active") {
        throw new CreatorLifecycleUnavailableError(`Creator ${creatorId} lifecycle is invalid`);
      }
      await client.query(`UPDATE creators SET lifecycle_status = 'erasing' WHERE id = $1`, [creatorId]);
      await client.query("COMMIT");
      return { alreadyErasing: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async completeAccountErasure(creatorId: CreatorId): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await acquireCreatorExclusiveXactLock(client, creatorId);
      const creator = await client.query<{ lifecycle_status: string }>(
        `SELECT lifecycle_status FROM creators WHERE id = $1 FOR UPDATE`,
        [creatorId],
      );
      if (creator.rowCount === 0) {
        throw new CreatorLifecycleUnavailableError(`Creator ${creatorId} is unavailable`);
      }
      if (creator.rows[0]!.lifecycle_status !== "erasing") {
        throw new CreatorLifecycleUnavailableError(`Creator ${creatorId} is not in erasing lifecycle`);
      }

      const handoffs = await client.query<{ id: string; source_conversation_id: string | null }>(
        `SELECT id, source_conversation_id FROM handoffs WHERE owner_creator_id = $1 ORDER BY id FOR UPDATE`,
        [creatorId],
      );

      const sourceIds = [
        ...new Set(
          handoffs.rows.map((row) => row.source_conversation_id).filter((id): id is string => id !== null),
        ),
      ].sort();

      for (const sourceId of sourceIds) {
        await client.query(`SELECT id FROM source_conversations WHERE id = $1 FOR UPDATE`, [sourceId]);
      }

      for (const handoff of handoffs.rows) {
        await client.query(`DELETE FROM share_capabilities WHERE handoff_id = $1`, [handoff.id]);
        await client.query(`DELETE FROM published_handoff_provenance WHERE handoff_id = $1`, [handoff.id]);
        await client.query(`DELETE FROM published_handoff_versions WHERE handoff_id = $1`, [handoff.id]);
        await client.query(`DELETE FROM handoff_drafts WHERE handoff_id = $1`, [handoff.id]);
        await client.query(`DELETE FROM handoffs WHERE id = $1`, [handoff.id]);
      }

      for (const sourceId of sourceIds) {
        await deleteSourceConversationIfUnreferenced(client, sourceId);
      }

      await client.query(`DELETE FROM creator_external_identities WHERE creator_id = $1`, [creatorId]);
      await client.query(`DELETE FROM creators WHERE id = $1`, [creatorId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
