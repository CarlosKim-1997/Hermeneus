import { draftHandoffSchema, type DraftHandoff } from "../../handoff/schema.js";
import { PersistenceConflictError } from "../errors.js";
import type { DraftRepository, DraftSaveResult } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresDraftRepository implements DraftRepository {
  constructor(private readonly db: Queryable) {}

  async save(draft: DraftHandoff, expectedRevision?: number): Promise<DraftSaveResult> {
    const parsed = draftHandoffSchema.parse(draft);
    const existing = await this.db.query<{ revision: number }>(
      "SELECT revision FROM handoff_drafts WHERE handoff_id = $1",
      [parsed.id],
    );

    if (existing.rowCount === 0) {
      if (expectedRevision !== undefined) {
        throw new PersistenceConflictError(`Draft ${parsed.id} does not exist for expected revision ${expectedRevision}`);
      }
      await this.db.query(
        `INSERT INTO handoff_drafts (handoff_id, revision, snapshot_json, updated_at)
         VALUES ($1, 1, $2::jsonb, NOW())`,
        [parsed.id, JSON.stringify(parsed)],
      );
      return { revision: 1 };
    }

    const currentRevision = existing.rows[0].revision;
    if (expectedRevision === undefined) {
      throw new PersistenceConflictError(`Draft ${parsed.id} already exists at revision ${currentRevision}`);
    }
    if (expectedRevision !== currentRevision) {
      throw new PersistenceConflictError(
        `Draft ${parsed.id} revision conflict: expected ${expectedRevision}, found ${currentRevision}`,
      );
    }

    const updated = await this.db.query<{ revision: number }>(
      `UPDATE handoff_drafts
       SET revision = $2,
           snapshot_json = $3::jsonb,
           updated_at = NOW()
       WHERE handoff_id = $1 AND revision = $4
       RETURNING revision`,
      [parsed.id, currentRevision + 1, JSON.stringify(parsed), expectedRevision],
    );
    if (updated.rowCount === 0) {
      throw new PersistenceConflictError(`Draft ${parsed.id} revision ${expectedRevision} is stale`);
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
