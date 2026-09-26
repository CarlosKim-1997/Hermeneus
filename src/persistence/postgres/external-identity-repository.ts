import type { CreatorId } from "../../creator/types.js";
import type { ExternalIdentityRepository } from "../ports.js";
import type { Queryable } from "./pool.js";
import type { PostgresCreatorRepository } from "./creator-repository.js";

export class PostgresExternalIdentityRepository implements ExternalIdentityRepository {
  constructor(
    private readonly db: Queryable,
    private readonly creators: PostgresCreatorRepository,
  ) {}

  async resolve(provider: string, subject: string): Promise<CreatorId | undefined> {
    const result = await this.db.query<{ creator_id: string }>(
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

    await this.creators.ensure({ id: input.candidateCreatorId, createdAt: input.createdAt });
    const inserted = await this.db.query<{ creator_id: string }>(
      `INSERT INTO creator_external_identities (provider, subject, creator_id, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, subject) DO NOTHING
       RETURNING creator_id`,
      [input.provider, input.subject, input.candidateCreatorId, input.createdAt],
    );
    if (inserted.rowCount && inserted.rowCount > 0) {
      return input.candidateCreatorId;
    }

    const raced = await this.resolve(input.provider, input.subject);
    if (!raced) {
      throw new Error("External identity mapping race did not resolve to a Creator");
    }
    return raced;
  }
}
