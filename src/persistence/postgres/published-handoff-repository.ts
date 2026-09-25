import type { Pool } from "pg";
import { draftHandoffSchema, publishedHandoffSchema, type PublishedHandoff } from "../../handoff/schema.js";
import type { PublishedHandoffRepository } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresPublishedHandoffRepository implements PublishedHandoffRepository {
  constructor(private readonly pool: Pool) {}

  async publish(handoffId: string, publishedAt: string): Promise<PublishedHandoff> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM handoffs WHERE id = $1 FOR UPDATE", [handoffId]);

      const draftResult = await client.query<{ snapshot_json: unknown }>(
        "SELECT snapshot_json FROM handoff_drafts WHERE handoff_id = $1",
        [handoffId],
      );
      if (draftResult.rowCount === 0) {
        throw new Error(`No draft exists for handoff ${handoffId}`);
      }
      const draft = draftHandoffSchema.parse(draftResult.rows[0].snapshot_json);

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
        items: structuredClone(draft.items),
      });

      await client.query(
        `INSERT INTO published_handoff_versions (handoff_id, version, published_at, snapshot_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [handoffId, version, publishedAt, JSON.stringify(snapshot)],
      );
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
