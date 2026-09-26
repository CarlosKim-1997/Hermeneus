import type { CreatorId } from "../../creator/types.js";
import type { CreatorRepository } from "../ports.js";
import type { Queryable } from "./pool.js";

export class PostgresCreatorRepository implements CreatorRepository {
  constructor(private readonly db: Queryable) {}

  async ensure(input: { id: CreatorId; createdAt: string }): Promise<void> {
    await this.db.query(
      `INSERT INTO creators (id, created_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [input.id, input.createdAt],
    );
  }

  async exists(id: CreatorId): Promise<boolean> {
    const result = await this.db.query(`SELECT 1 FROM creators WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
