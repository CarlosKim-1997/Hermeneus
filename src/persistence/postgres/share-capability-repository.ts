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
    const result = await this.pool.query<Row>(
      `INSERT INTO share_capabilities (id, handoff_id, version, token_hash, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, handoff_id, version, token_hash, created_at, revoked_at`,
      [input.id, input.handoffId, input.version, input.tokenHash, input.createdAt],
    );
    return mapMetadata(result.rows[0]!);
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
