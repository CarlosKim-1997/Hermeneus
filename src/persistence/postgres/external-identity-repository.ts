import { createHash } from "node:crypto";
import type pg from "pg";
import type { CreatorId } from "../../creator/types.js";
import type { ExternalIdentityRepository } from "../ports.js";

function advisoryLockKeys(provider: string, subject: string): [number, number] {
  const digest = createHash("sha256").update(`${provider}\0${subject}`).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

export class PostgresExternalIdentityRepository implements ExternalIdentityRepository {
  constructor(private readonly pool: pg.Pool) {}

  async resolve(provider: string, subject: string): Promise<CreatorId | undefined> {
    const result = await this.pool.query<{ creator_id: string }>(
      `SELECT creator_id FROM creator_external_identities WHERE provider = $1 AND subject = $2`,
      [provider, subject],
    );
    if (result.rowCount === 0) return undefined;
    return result.rows[0]!.creator_id;
  }

  async resolveOrCreate(input: {
    provider: string;
    subject: string;
    candidateCreatorId: CreatorId;
    createdAt: string;
  }): Promise<CreatorId> {
    const existing = await this.resolve(input.provider, input.subject);
    if (existing) return existing;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const [lockA, lockB] = advisoryLockKeys(input.provider, input.subject);
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [lockA, lockB]);

      const lockedLookup = await client.query<{ creator_id: string }>(
        `SELECT creator_id FROM creator_external_identities WHERE provider = $1 AND subject = $2`,
        [input.provider, input.subject],
      );
      if (lockedLookup.rowCount && lockedLookup.rowCount > 0) {
        await client.query("COMMIT");
        return lockedLookup.rows[0]!.creator_id;
      }

      await client.query(`INSERT INTO creators (id, created_at) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        input.candidateCreatorId,
        input.createdAt,
      ]);

      if (
        process.env.HERMENEUS_TEST_SIMULATE_EXTERNAL_MAPPING_FAILURE === "1" &&
        input.subject === "subject-mapping-failure"
      ) {
        throw new Error("simulated external identity mapping failure");
      }

      await client.query(
        `INSERT INTO creator_external_identities (provider, subject, creator_id, created_at)
         VALUES ($1, $2, $3, $4)`,
        [input.provider, input.subject, input.candidateCreatorId, input.createdAt],
      );
      await client.query("COMMIT");
      return input.candidateCreatorId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
