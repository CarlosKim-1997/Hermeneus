import { draftHandoffSchema, type DraftHandoff } from "../../handoff/schema.js";
import { PersistenceConflictError } from "../errors.js";
import type { DraftRepository, DraftSaveResult } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresDraftRepository implements DraftRepository {
  constructor(private readonly db: Queryable) {}

  async save(draft: DraftHandoff, expectedRevision?: number): Promise<DraftSaveResult> {
    const parsed = draftHandoffSchema.parse(draft);

    if (expectedRevision === undefined) {
      const inserted = await this.db.query<{ revision: number }>(
        `INSERT INTO handoff_drafts (handoff_id, revision, snapshot_json, updated_at)
         VALUES ($1, 1, $2::jsonb, NOW())
         ON CONFLICT (handoff_id) DO NOTHING
         RETURNING revision`,
        [parsed.id, JSON.stringify(parsed)],
      );
      if (inserted.rowCount && inserted.rowCount > 0) {
        return { revision: inserted.rows[0].revision };
      }
      throw new PersistenceConflictError(`Draft ${parsed.id} already exists`);
    }

    const updated = await this.db.query<{ revision: number }>(
      `UPDATE handoff_drafts
       SET revision = $2,
           snapshot_json = $3::jsonb,
           updated_at = NOW()
       WHERE handoff_id = $1 AND revision = $4
       RETURNING revision`,
      [parsed.id, expectedRevision + 1, JSON.stringify(parsed), expectedRevision],
    );
    if (updated.rowCount === 0) {
      const current = await this.db.query<{ revision: number }>(
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
    return { revision: updated.rows[0].revision };
  }

  async get(handoffId: string): Promise<DraftHandoff | undefined> {
    const result = await this.db.query<{ snapshot_json: DraftHandoff }>(
      "SELECT snapshot_json FROM handoff_drafts WHERE handoff_id = $1",
      [handoffId],
    );
    if (result.rowCount === 0) return undefined;
    return draftHandoffSchema.parse(result.rows[0].snapshot_json);
  }

  async getRevision(handoffId: string): Promise<number | undefined> {
    const result = await this.db.query<{ revision: number }>(
      "SELECT revision FROM handoff_drafts WHERE handoff_id = $1",
      [handoffId],
    );
    if (result.rowCount === 0) return undefined;
    return result.rows[0].revision;
  }
}
