import type { Pool } from "pg";
import {
  draftHandoffSchema,
  publishedHandoffSchema,
  toPublishedCanonicalItems,
  type DraftHandoff,
  type PublishedHandoff,
} from "../../handoff/schema.js";
import { PersistenceConflictError } from "../errors.js";
import type { PublishedHandoffRepository } from "../ports.js";
import type { Queryable } from "./pool.js";
import { validatePublicationProvenance } from "./validate-publication-provenance.js";
import { lockActiveCreatorMutation } from "./active-creator-mutation.js";

export class PostgresPublishedHandoffRepository implements PublishedHandoffRepository {
  constructor(private readonly pool: Pool) {}

  async publish(
    handoffId: string,
    publishedAt: string,
    expectedDraftRevision: number,
  ): Promise<PublishedHandoff> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const ownerRow = await client.query<{ owner_creator_id: string }>(
        `SELECT owner_creator_id FROM handoffs WHERE id = $1`,
        [handoffId],
      );
      if (ownerRow.rowCount === 0) {
        throw new Error(`No handoff exists for ${handoffId}`);
      }
      await lockActiveCreatorMutation(client, ownerRow.rows[0]!.owner_creator_id);
      await client.query("SELECT id FROM handoffs WHERE id = $1 FOR UPDATE", [handoffId]);

      const draftResult = await client.query<{ revision: number; snapshot_json: unknown }>(
        `SELECT revision, snapshot_json
         FROM handoff_drafts
         WHERE handoff_id = $1
         FOR UPDATE`,
        [handoffId],
      );
      if (draftResult.rowCount === 0) {
        throw new Error(`No draft exists for handoff ${handoffId}`);
      }
      const draftRow = draftResult.rows[0];
      if (draftRow.revision !== expectedDraftRevision) {
        throw new PersistenceConflictError(
          `Draft ${handoffId} revision conflict at publication: expected ${expectedDraftRevision}, found ${draftRow.revision}`,
        );
      }

      const draft = draftHandoffSchema.parse(draftRow.snapshot_json);
      await validatePublicationProvenance(client, handoffId, draft);

      const versionResult = await client.query<{ next_version: number }>(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM published_handoff_versions
         WHERE handoff_id = $1`,
        [handoffId],
      );
      const version = versionResult.rows[0].next_version;
      const snapshot = publishedHandoffSchema.parse({
        handoffId,
        version,
        publishedAt,
        items: toPublishedCanonicalItems(draft.items),
      });

      await client.query(
        `INSERT INTO published_handoff_versions (handoff_id, version, published_at, snapshot_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [handoffId, version, publishedAt, JSON.stringify(snapshot)],
      );

      for (const item of draft.items) {
        for (const [sourceIndex, source] of item.sources.entries()) {
          await client.query(
            `INSERT INTO published_handoff_provenance
               (handoff_id, version, item_id, source_index, message_id, excerpt)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [handoffId, version, item.id, sourceIndex, source.messageId, source.excerpt ?? null],
          );
        }
      }

      await client.query("COMMIT");
      return snapshot;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async get(handoffId: string, version: number): Promise<PublishedHandoff | undefined> {
    return readPublished(this.pool, handoffId, version);
  }

  async listVersions(handoffId: string): Promise<Array<{ version: number; publishedAt: string }>> {
    const result = await this.pool.query<{ version: number; published_at: Date }>(
      `SELECT version, published_at
       FROM published_handoff_versions
       WHERE handoff_id = $1
       ORDER BY version ASC`,
      [handoffId],
    );
    return result.rows.map((row) => ({
      version: row.version,
      publishedAt: row.published_at.toISOString(),
    }));
  }
}

async function readPublished(db: Queryable, handoffId: string, version: number): Promise<PublishedHandoff | undefined> {
  const result = await db.query<{ snapshot_json: unknown }>(
    `SELECT snapshot_json
     FROM published_handoff_versions
     WHERE handoff_id = $1 AND version = $2`,
    [handoffId, version],
  );
  if (result.rowCount === 0) return undefined;
  return publishedHandoffSchema.parse(result.rows[0].snapshot_json);
}
