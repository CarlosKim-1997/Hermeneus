import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resolveOrCreateCreatorForExternalIdentity } from "../../src/application/use-cases/resolve-external-creator.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { createPool } from "../../src/persistence/postgres/pool.js";

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  describe.skip("External identity mapping", () => {
    it("requires TEST_DATABASE_URL", () => undefined);
  });
} else {
  describe("External identity mapping (EI)", () => {
    const pool = createPool(url);
    const repos = createPostgresRepositories(pool);

    beforeAll(() => {
      execSync("node scripts/migrate.mjs", { env: { ...process.env, TEST_DATABASE_URL: url }, stdio: "pipe" });
    });

    beforeEach(async () => {
      await pool.query(
        "TRUNCATE creator_external_identities, share_capabilities, published_handoff_provenance, published_handoff_versions, handoff_drafts, handoffs, source_messages, source_conversations, creators RESTART IDENTITY CASCADE",
      );
    });

    afterAll(async () => {
      await pool.end();
    });

    it("EI1 — new Google subject creates Creator + mapping", async () => {
      const creatorId = await resolveOrCreateCreatorForExternalIdentity(repos, {
        provider: "google",
        subject: "subject-new-1",
      });
      expect(creatorId).toMatch(/^creator_/);
      expect(await repos.externalIdentities.resolve("google", "subject-new-1")).toBe(creatorId);
      expect(await repos.creators.exists(creatorId)).toBe(true);
    });

    it("EI2 — same Google subject returns same Creator", async () => {
      const first = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-a" });
      const second = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-a" });
      expect(second).toBe(first);
      const count = await pool.query(`SELECT COUNT(*)::int AS c FROM creators`);
      expect(count.rows[0]!.c).toBe(1);
    });

    it("EI3 — different Google subject creates different Creator", async () => {
      const a = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-a" });
      const b = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-b" });
      expect(a).not.toBe(b);
    });

    it("EI4 — mapping does not use email (different subjects stay distinct)", async () => {
      const a = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-email-a" });
      const b = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-email-b" });
      expect(a).not.toBe(b);
      const columns = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'creator_external_identities'`,
      );
      expect(columns.rows.map((row) => row.column_name)).not.toContain("email");
    });

    it("EI5 — provider namespace distinguishes same subject string", async () => {
      const google = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-123" });
      const github = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "github", subject: "subject-123" });
      expect(google).not.toBe(github);
    });

    it("EI6 — mapping cannot be reassigned", async () => {
      const creatorId = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-immutable" });
      await expect(
        pool.query(`UPDATE creator_external_identities SET creator_id = $1 WHERE provider = 'google' AND subject = 'subject-immutable'`, [
          "creator_other",
        ]),
      ).rejects.toThrow(/immutable/i);
      expect(await repos.externalIdentities.resolve("google", "subject-immutable")).toBe(creatorId);
    });

    it("EI6b — mapping deletion rejected", async () => {
      const creatorId = await resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-no-delete" });
      await expect(
        pool.query(`DELETE FROM creator_external_identities WHERE provider = 'google' AND subject = 'subject-no-delete'`),
      ).rejects.toThrow(/not erasing/i);
      expect(await repos.externalIdentities.resolve("google", "subject-no-delete")).toBe(creatorId);
    });

    it("EI7 — concurrent first login resolves to one Creator", async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-concurrent" }),
        ),
      );
      expect(new Set(results).size).toBe(1);
      const mappingCount = await pool.query(
        `SELECT COUNT(*)::int AS c FROM creator_external_identities WHERE provider = 'google' AND subject = 'subject-concurrent'`,
      );
      expect(mappingCount.rows[0]!.c).toBe(1);
      const creatorCount = await pool.query(`SELECT COUNT(*)::int AS c FROM creators`);
      expect(creatorCount.rows[0]!.c).toBe(1);
    });

    it("EI10 — candidate Creator ID collision fails closed", async () => {
      const existingId = "creator_collision_existing";
      await repos.creators.ensure({ id: existingId, createdAt: "2026-09-27T00:00:00.000Z" });
      await expect(
        repos.externalIdentities.resolveOrCreate({
          provider: "google",
          subject: "subject-collision-test",
          candidateCreatorId: existingId,
          createdAt: "2026-09-27T00:00:00.000Z",
        }),
      ).rejects.toThrow();
      expect(await repos.externalIdentities.resolve("google", "subject-collision-test")).toBeUndefined();
      expect(await repos.creators.exists(existingId)).toBe(true);
      const mappingCount = await pool.query(
        `SELECT COUNT(*)::int AS c FROM creator_external_identities WHERE provider = 'google' AND subject = 'subject-collision-test'`,
      );
      expect(mappingCount.rows[0]!.c).toBe(0);
    });

    it("EI9 — failed mapping registration rolls back Creator row", async () => {
      process.env.HERMENEUS_TEST_SIMULATE_EXTERNAL_MAPPING_FAILURE = "1";
      await expect(
        resolveOrCreateCreatorForExternalIdentity(repos, { provider: "google", subject: "subject-mapping-failure" }),
      ).rejects.toThrow(/simulated external identity mapping failure/i);
      expect(await repos.externalIdentities.resolve("google", "subject-mapping-failure")).toBeUndefined();
      const creatorCount = await pool.query(`SELECT COUNT(*)::int AS c FROM creators`);
      expect(creatorCount.rows[0]!.c).toBe(0);
      delete process.env.HERMENEUS_TEST_SIMULATE_EXTERNAL_MAPPING_FAILURE;
    });

    it("EI8 — no OAuth token columns in Hermeneus tables", async () => {
      const sql = await readFile(
        path.join(path.dirname(fileURLToPath(import.meta.url)), "../../migrations/004_external_identities.sql"),
        "utf8",
      );
      expect(sql.toLowerCase()).not.toContain("access_token");
      expect(sql.toLowerCase()).not.toContain("refresh_token");
      expect(sql.toLowerCase()).not.toContain("id_token");
    });
  });
}
