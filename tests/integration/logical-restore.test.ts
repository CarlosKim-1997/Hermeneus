import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../../scripts/migration-runner.mjs";
import { createDraft } from "../../src/handoff/draft.js";
import { createPostgresRepositories } from "../../src/persistence/postgres/create-repositories.js";
import { isSchemaReady } from "../../src/persistence/postgres/schema-readiness.js";

const url = process.env.TEST_DATABASE_URL;
const container = process.env.TEST_POSTGRES_CONTAINER;
const local = url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
if (process.env.CI === "true" && (!local || !container)) {
  throw new Error("CI restore verification requires its disposable PostgreSQL URL and service container ID");
}

describe.skipIf(!local || !container)("isolated synthetic PostgreSQL logical restore", () => {
  it("restores snapshots, lifecycle guards, revocations and ACLs; demonstrates post-backup erasure drift", async () => {
    // Only fresh databases created here may be dump/restore/drop targets. Never use a shared DB.
    const prefix = `hermeneus_restore_${randomUUID().replaceAll("-", "")}`;
    const sourceName = `${prefix}_source`, targetName = `${prefix}_target`;
    const archive = `/tmp/${prefix}.dump`;
    const sourceUrl = new URL(url!), targetUrl = new URL(url!);
    sourceUrl.pathname = `/${sourceName}`;
    targetUrl.pathname = `/${targetName}`;
    const admin = new pg.Client({ connectionString: url });
    const source = new pg.Pool({ connectionString: sourceUrl.toString() });
    const target = new pg.Pool({ connectionString: targetUrl.toString() });
    const created: string[] = [];
    const createdRoles: string[] = [];
    const docker = (args: string[]) => execFileSync("docker", ["exec", container!, ...args], { timeout: 30_000, stdio: "pipe" });
    await admin.connect();
    try {
      // Prove the named container serves the supplied local URL before copying anything.
      const expected = (await admin.query("SELECT system_identifier::text FROM pg_control_system()")).rows[0].system_identifier;
      const owner = decodeURIComponent(new URL(url!).username);
      const actual = docker(["psql", "-U", owner, "-d", decodeURIComponent(new URL(url!).pathname.slice(1)), "-Atc", "SELECT system_identifier FROM pg_control_system()"]);
      expect(actual.toString().trim()).toBe(expected);
      for (const role of ["anon", "authenticated"]) {
        if ((await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rowCount === 0) {
          await admin.query(`CREATE ROLE "${role}" NOLOGIN`);
          createdRoles.push(role);
        }
      }
      for (const name of [sourceName, targetName]) {
        await admin.query(`CREATE DATABASE "${name}"`);
        created.push(name);
      }
      const client = await source.connect();
      try { await runMigrations(client, { directory: path.resolve("migrations") }); } finally { client.release(); }
      const repos = createPostgresRepositories(source);
      const time = "2026-10-13T00:00:00.000Z";
      await repos.creators.ensure({ id: "synthetic-owner", createdAt: time });
      for (const id of ["retained", "erased-before", "erased-after"]) {
        await repos.conversations.create({ id: `${id}-source`, source: { provider: "generic-text", importedAt: time },
          messages: [{ id: `${id}-message`, role: "creator", content: "Synthetic restore fixture.", source: { provider: "generic-text" } }] });
        await repos.handoffs.create(id, `${id}-source`, "synthetic-owner");
        await repos.drafts.save(createDraft(id, [{ id: "fixture", type: "CONFIRMED", statement: "Synthetic restore fixture.",
          priority: "CORE", createdBy: "CREATOR", sources: [{ messageId: `${id}-message`, excerpt: "Synthetic restore fixture." }] }]));
        await repos.published.publish(id, time, 1);
      }
      await repos.shareCapabilities.create({ id: "revoked-before", handoffId: "retained", version: 1, tokenHash: "synthetic-revoked-hash", createdAt: time });
      await repos.shareCapabilities.revoke("revoked-before", time);
      await repos.shareCapabilities.create({ id: "revoked-after", handoffId: "retained", version: 1, tokenHash: "synthetic-later-hash", createdAt: time });
      await repos.erasure.deleteHandoff("erased-before", "synthetic-owner");
      await repos.creators.ensure({ id: "synthetic-erasing", createdAt: time });
      await source.query("UPDATE creators SET lifecycle_status='erasing' WHERE id='synthetic-erasing'");

      async function snapshot(db: pg.Pool) {
        const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
        const result: Record<string, unknown> = {};
        for (const { tablename } of tables) {
          if (!/^[a-z_]+$/.test(tablename)) throw new Error("Unexpected fixture table");
          result[tablename] = (await db.query(`SELECT to_jsonb(t) AS row FROM public."${tablename}" t ORDER BY to_jsonb(t)::text`)).rows;
        }
        // pg_dump may omit an explicit owner-only ACL equivalent to the default.
        result.acls = (await db.query("SELECT relname, coalesce(relacl,acldefault('r',relowner))::text AS acl FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname='public' AND relkind='r' ORDER BY relname")).rows;
        result.functions = (await db.query("SELECT proname, proacl::text, pg_get_functiondef(pg_proc.oid) AS definition FROM pg_proc JOIN pg_namespace ON pg_namespace.oid=pronamespace WHERE nspname='public' ORDER BY proname")).rows;
        result.defaults = (await db.query("SELECT defaclobjtype, defaclacl::text FROM pg_default_acl ORDER BY defaclobjtype, defaclacl::text")).rows;
        return result;
      }
      const before = await snapshot(source);
      const started = performance.now();
      docker(["pg_dump", "-U", owner, "-d", sourceName, "--format=custom", `--file=${archive}`]);
      // These events are deliberately later than the backup: a restore cannot know them.
      await repos.shareCapabilities.revoke("revoked-after", time);
      await repos.erasure.deleteHandoff("erased-after", "synthetic-owner");
      docker(["pg_restore", "-U", owner, "-d", targetName, "--exit-on-error", "--single-transaction", archive]);
      expect(await snapshot(target)).toEqual(before);
      expect(await isSchemaReady(target)).toBe(true);
      expect((await target.query("SELECT count(*)::integer AS n FROM handoffs WHERE id='erased-before'")).rows[0].n).toBe(0);
      expect((await target.query("SELECT revoked_at FROM share_capabilities WHERE id='revoked-before'")).rows[0].revoked_at).not.toBeNull();
      await expect(target.query("UPDATE published_handoff_versions SET snapshot_json=snapshot_json WHERE handoff_id='retained'")).rejects.toThrow("immutable");
      await expect(target.query("UPDATE share_capabilities SET revoked_at=NULL WHERE id='revoked-before'")).rejects.toThrow();
      await expect(target.query("UPDATE creators SET lifecycle_status='active' WHERE id='synthetic-erasing'")).rejects.toThrow();
      await expect(target.query("UPDATE handoffs SET owner_creator_id='synthetic-erasing' WHERE id='retained'")).rejects.toThrow("immutable");
      expect((await target.query("SELECT count(*)::integer AS n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE ns.nspname='public' AND c.relkind='r' AND a.grantee=0")).rows[0].n).toBe(0);
      await target.query("CREATE TABLE public.future_private(id integer)");
      await target.query("CREATE FUNCTION public.future_private_function() RETURNS integer LANGUAGE SQL AS 'SELECT 1'");
      for (const role of ["anon", "authenticated"]) {
        const access = (await target.query("SELECT has_table_privilege($1,'public.handoffs','SELECT') AS existing_table, has_function_privilege($1,'public.prevent_published_handoff_update()','EXECUTE') AS existing_function, has_table_privilege($1,'public.future_private','SELECT') AS future_table, has_function_privilege($1,'public.future_private_function()','EXECUTE') AS future_function", [role])).rows[0];
        expect(access).toEqual({ existing_table: false, existing_function: false, future_table: false, future_function: false });
      }
      // Stale restore is quarantined: readiness alone would wrongly accept this older data.
      expect((await source.query("SELECT count(*)::integer AS n FROM handoffs WHERE id='erased-after'")).rows[0].n).toBe(0);
      expect((await target.query("SELECT count(*)::integer AS n FROM handoffs WHERE id='erased-after'")).rows[0].n).toBe(1);
      expect((await target.query("SELECT revoked_at FROM share_capabilities WHERE id='revoked-after'")).rows[0].revoked_at).toBeNull();
      console.log(`Synthetic logical dump/restore and checks: ${Math.round(performance.now() - started)}ms (local rehearsal, not RPO/RTO or PITR evidence)`);
    } finally {
      await source.end();
      await target.end();
      try {
        for (const name of created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
        if (created.length) docker(["rm", "-f", archive]);
        for (const role of createdRoles) await admin.query(`DROP ROLE "${role}"`);
      } finally { await admin.end(); }
    }
  }, 60_000);
});
