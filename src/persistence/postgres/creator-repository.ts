import type { CreatorId } from "../../creator/types.js";
import type { CreatorLifecycleStatus } from "../../creator/types.js";
import type { CreatorRepository } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresCreatorRepository implements CreatorRepository {
  constructor(private readonly db: Queryable) {}

  async ensure(input: { id: CreatorId; createdAt: string }): Promise<void> {
    await this.db.query(
      `INSERT INTO creators (id, created_at, lifecycle_status) VALUES ($1, $2, 'active') ON CONFLICT (id) DO NOTHING`,
      [input.id, input.createdAt],
    );
  }

  async exists(id: CreatorId): Promise<boolean> {
    const result = await this.db.query(`SELECT 1 FROM creators WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getLifecycleStatus(id: CreatorId): Promise<CreatorLifecycleStatus | undefined> {
    const result = await this.db.query<{ lifecycle_status: CreatorLifecycleStatus }>(
      `SELECT lifecycle_status FROM creators WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) return undefined;
    return result.rows[0]!.lifecycle_status;
  }
}
