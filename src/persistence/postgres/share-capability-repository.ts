import type { Pool } from "pg";
import type { ShareCapabilityMetadata, ShareCapabilityTarget } from "../../share/types.js";
import type { ShareCapabilityRepository } from "../ports.js";

type Row = {
  id: string;
  handoff_id: string;
  version: number;
  token_hash: string;
  created_at: Date;
  revoked_at: Date | null;
};

function mapMetadata(row: Row): ShareCapabilityMetadata {
  return {
    id: row.id,
    handoffId: row.handoff_id,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString(),
  };
}

export class PostgresShareCapabilityRepository implements ShareCapabilityRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    id: string;
    handoffId: string;
    version: number;
    tokenHash: string;
    createdAt: string;
  }): Promise<ShareCapabilityMetadata> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const handoff = await client.query(`SELECT 1 FROM handoffs WHERE id = $1 FOR SHARE`, [input.handoffId]);
      if (handoff.rowCount === 0) {
        throw new Error(`Handoff ${input.handoffId} is unavailable for share issuance`);
      }
      const published = await client.query(
        `SELECT 1 FROM published_handoff_versions WHERE handoff_id = $1 AND version = $2`,
        [input.handoffId, input.version],
      );
      if (published.rowCount === 0) {
        throw new Error(`Published version ${input.version} is unavailable for handoff ${input.handoffId}`);
      }
      const result = await client.query<Row>(
        `INSERT INTO share_capabilities (id, handoff_id, version, token_hash, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, handoff_id, version, token_hash, created_at, revoked_at`,
        [input.id, input.handoffId, input.version, input.tokenHash, input.createdAt],
      );
      await client.query("COMMIT");
      return mapMetadata(result.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async resolveActiveByTokenHash(tokenHash: string): Promise<ShareCapabilityTarget | undefined> {
    const result = await this.pool.query<Pick<Row, "handoff_id" | "version">>(
      `SELECT handoff_id, version
       FROM share_capabilities
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
    if (result.rowCount === 0) return undefined;
    const row = result.rows[0]!;
    return { handoffId: row.handoff_id, version: row.version };
  }

  async listForPublishedVersion(handoffId: string, version: number): Promise<ShareCapabilityMetadata[]> {
    const result = await this.pool.query<Row>(
      `SELECT id, handoff_id, version, token_hash, created_at, revoked_at
       FROM share_capabilities
       WHERE handoff_id = $1 AND version = $2
       ORDER BY created_at ASC`,
      [handoffId, version],
    );
    return result.rows.map(mapMetadata);
  }

  async getMetadataById(capabilityId: string): Promise<ShareCapabilityMetadata | undefined> {
    const result = await this.pool.query<Row>(`SELECT id, handoff_id, version, token_hash, created_at, revoked_at FROM share_capabilities WHERE id = $1`, [
      capabilityId,
    ]);
    if (result.rowCount === 0) return undefined;
    return mapMetadata(result.rows[0]!);
  }

  async revoke(capabilityId: string, revokedAt: string): Promise<ShareCapabilityMetadata | undefined> {
    const result = await this.pool.query<Row>(
      `UPDATE share_capabilities
       SET revoked_at = COALESCE(revoked_at, $2::timestamptz)
       WHERE id = $1
       RETURNING id, handoff_id, version, token_hash, created_at, revoked_at`,
      [capabilityId, revokedAt],
    );
    if (result.rowCount === 0) return undefined;
    return mapMetadata(result.rows[0]!);
  }

}
