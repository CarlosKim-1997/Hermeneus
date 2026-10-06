import type { Pool } from "pg";
import { draftHandoffSchema, type DraftHandoff } from "../../handoff/schema.js";
import { PersistenceConflictError, SourceBackedDraftRejectedError } from "../errors.js";
import type { DraftRepository, DraftSaveResult } from "../ports.js";

function draftHasSourceReferences(draft: DraftHandoff): boolean {
  return draft.items.some((item) => item.sources.length > 0);
}

export class PostgresDraftRepository implements DraftRepository {
  constructor(private readonly pool: Pool) {}

  async save(draft: DraftHandoff, expectedRevision?: number): Promise<DraftSaveResult> {
    const parsed = draftHandoffSchema.parse(draft);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const handoff = await client.query<{ source_erased_at: Date | null }>(
        `SELECT source_erased_at FROM handoffs WHERE id = $1 FOR UPDATE`,
        [parsed.id],
      );
      if (handoff.rowCount === 0) {
        throw new PersistenceConflictError(`Draft ${parsed.id} does not exist for expected revision ${expectedRevision ?? 0}`);
      }
      if (handoff.rows[0]!.source_erased_at !== null && draftHasSourceReferences(parsed)) {
        throw new SourceBackedDraftRejectedError(
          `Handoff ${parsed.id} source is erased; draft cannot contain source references`,
        );
      }

      let result: DraftSaveResult;
      if (expectedRevision === undefined) {
        const inserted = await client.query<{ revision: number }>(
          `INSERT INTO handoff_drafts (handoff_id, revision, snapshot_json, updated_at)
           VALUES ($1, 1, $2::jsonb, NOW())
           ON CONFLICT (handoff_id) DO NOTHING
           RETURNING revision`,
          [parsed.id, JSON.stringify(parsed)],
        );
        if (inserted.rowCount && inserted.rowCount > 0) {
          result = { revision: inserted.rows[0].revision };
        } else {
          throw new PersistenceConflictError(`Draft ${parsed.id} already exists`);
        }
      } else {
        const updated = await client.query<{ revision: number }>(
          `UPDATE handoff_drafts
           SET revision = $2,
               snapshot_json = $3::jsonb,
               updated_at = NOW()
           WHERE handoff_id = $1 AND revision = $4
           RETURNING revision`,
          [parsed.id, expectedRevision + 1, JSON.stringify(parsed), expectedRevision],
        );
        if (updated.rowCount === 0) {
          const current = await client.query<{ revision: number }>(
            "SELECT revision FROM handoff_drafts WHERE handoff_id = $1",
            [parsed.id],
          );
          if (current.rowCount === 0) {
            throw new PersistenceConflictError(`Draft ${parsed.id} does not exist for expected revision ${expectedRevision}`);
          }
          throw new PersistenceConflictError(
            `Draft ${parsed.id} revision conflict: expected ${expectedRevision}, found ${current.rows[0].revision}`,
          );
        }
        result = { revision: updated.rows[0].revision };
      }

      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async get(handoffId: string): Promise<DraftHandoff | undefined> {
    const result = await this.pool.query<{ snapshot_json: DraftHandoff }>(
      "SELECT snapshot_json FROM handoff_drafts WHERE handoff_id = $1",
      [handoffId],
    );
    if (result.rowCount === 0) return undefined;
    return draftHandoffSchema.parse(result.rows[0].snapshot_json);
  }

  async getRevision(handoffId: string): Promise<number | undefined> {
    const result = await this.pool.query<{ revision: number }>(
      "SELECT revision FROM handoff_drafts WHERE handoff_id = $1",
      [handoffId],
    );
    if (result.rowCount === 0) return undefined;
    return result.rows[0].revision;
  }
}
