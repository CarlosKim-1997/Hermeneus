import { draftHandoffSchema, type DraftHandoff } from "../../handoff/schema.js";
import type { DraftRepository } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresDraftRepository implements DraftRepository {
  constructor(private readonly db: Queryable) {}

  async save(draft: DraftHandoff): Promise<void> {
    const parsed = draftHandoffSchema.parse(draft);
    const existing = await this.db.query<{ revision: number }>(
      "SELECT revision FROM handoff_drafts WHERE handoff_id = $1",
      [parsed.id],
    );
    const revision = existing.rowCount ? existing.rows[0].revision + 1 : 1;
    await this.db.query(
      `INSERT INTO handoff_drafts (handoff_id, revision, snapshot_json, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (handoff_id) DO UPDATE
       SET revision = EXCLUDED.revision,
           snapshot_json = EXCLUDED.snapshot_json,
           updated_at = EXCLUDED.updated_at`,
      [parsed.id, revision, JSON.stringify(parsed)],
    );
  }

  async get(handoffId: string): Promise<DraftHandoff | undefined> {
    const result = await this.db.query<{ snapshot_json: DraftHandoff }>(
      "SELECT snapshot_json FROM handoff_drafts WHERE handoff_id = $1",
      [handoffId],
    );
    if (result.rowCount === 0) return undefined;
    return draftHandoffSchema.parse(result.rows[0].snapshot_json);
  }
}
