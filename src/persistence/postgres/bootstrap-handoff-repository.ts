import type { Pool } from "pg";
import { draftHandoffSchema } from "../../handoff/schema.js";
import type { BootstrapHandoffRepository } from "../ports.js";
import { lockActiveCreatorMutation } from "./active-creator-mutation.js";

export class PostgresBootstrapHandoffRepository implements BootstrapHandoffRepository {
  constructor(private readonly pool: Pool) {}

  async createAtomic(input: Parameters<BootstrapHandoffRepository["createAtomic"]>[0]) {
    const draft = draftHandoffSchema.parse(input.draft);
    if (draft.id !== input.handoffId || draft.items.length === 0 ||
        draft.items.some((item) => item.sources.length > 0)) {
      throw new Error("Bootstrap Draft must contain only source-free items for its Handoff");
    }
    if (input.requestKey.length < 16 || input.requestKey.length > 128) {
      throw new Error("Invalid bootstrap request key");
    }
    const displayTitle = input.displayTitle?.trim();
    if (displayTitle !== undefined && (displayTitle.length === 0 || Array.from(displayTitle).length > 160)) {
      throw new Error("Invalid display title");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockActiveCreatorMutation(client, input.ownerCreatorId);
      const existing = await client.query<{ id: string; revision: number }>(
        `SELECT h.id, d.revision FROM handoffs h
         JOIN handoff_drafts d ON d.handoff_id = h.id
         WHERE h.owner_creator_id = $1 AND h.bootstrap_request_key = $2`,
        [input.ownerCreatorId, input.requestKey],
      );
      if (existing.rowCount) {
        await client.query("COMMIT");
        return { handoffId: existing.rows[0]!.id, revision: existing.rows[0]!.revision, idempotent: true };
      }
      await client.query(
        `INSERT INTO handoffs
           (id, source_conversation_id, source_erased_at, ingress_kind, owner_creator_id, display_title, bootstrap_request_key)
         VALUES ($1, NULL, NULL, 'BOOTSTRAP_PROPOSAL', $2, $3, $4)`,
        [input.handoffId, input.ownerCreatorId, displayTitle ?? null, input.requestKey],
      );
      const inserted = await client.query<{ revision: number }>(
        `INSERT INTO handoff_drafts (handoff_id, revision, snapshot_json, updated_at)
         VALUES ($1, 1, $2::jsonb, NOW()) RETURNING revision`,
        [input.handoffId, JSON.stringify(draft)],
      );
      await client.query("COMMIT");
      return { handoffId: input.handoffId, revision: inserted.rows[0]!.revision, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
