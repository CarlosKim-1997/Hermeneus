import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { MIGRATION_LOCK_KEYS, runMigrations } from "../../scripts/migration-runner.mjs";
import { REQUIRED_MIGRATIONS, isSchemaReady } from "../../src/persistence/postgres/schema-readiness.js";

const testUrl = process.env.TEST_DATABASE_URL;
// These tests create/drop only their own databases on local disposable PostgreSQL.
const local = testUrl && ["localhost", "127.0.0.1", "::1"].includes(new URL(testUrl).hostname);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe.skipIf(!local)("migration serialization and schema readiness (disposable DB)", () => {
  const databases: string[] = [];
  const directories: string[] = [];
  const admin = new pg.Client({ connectionString: testUrl });
  beforeAll(async () => { await admin.connect(); });
  afterAll(async () => {
    for (const name of databases) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
    for (const directory of directories) {
      if (!directory.startsWith(path.join(os.tmpdir(), "hermeneus-migrations-"))) throw new Error("Unsafe test cleanup path");
      await rm(directory, { recursive: true, force: true });
    }
  });

  async function database() {
    const name = `hermeneus_slice_c_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    databases.push(name);
    const url = new URL(testUrl!);
    url.pathname = `/${name}`;
    return url.toString();
  }
  async function client(url: string) {
    const connection = new pg.Client({ connectionString: url });
    await connection.connect();
    return connection;
  }
  async function fixture(files: Record<string, string>) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "hermeneus-migrations-"));
    directories.push(directory);
    for (const [name, sql] of Object.entries(files)) await writeFile(path.join(directory, name), sql);
    return directory;
  }
  function cli(url: string): Promise<{ code: number | null; output: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["scripts/migrate.mjs"], {
        cwd: root, env: { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      child.on("error", reject);
      child.on("exit", (code) => resolve({ code, output }));
    });
  }

  it.each(["aws-0-ap-northeast-2.pooler.supabase.com", "db.synthetic.supabase.co"])(
    "rejects transaction pooling at %s before connecting and redacts the URL", async (host) => {
      const result = await cli(`postgresql://synthetic:private-test-password@${host}:6543/postgres`);
      expect(result.code).toBe(1);
      expect(result.output).toContain("Migration failed.");
      expect(result.output).not.toContain(host);
      expect(result.output).not.toContain("private-test-password");
      expect(result.output).not.toContain("applied ");
    },
  );

  it("two CLI migrators apply the complete repository schema exactly once", async () => {
    const url = await database();
    const results = await Promise.all([cli(url), cli(url)]);
    expect(results.map((r) => r.code)).toEqual([0, 0]);
    const applied = results.flatMap((r) => r.output.split(/\r?\n/).filter((line) => line.startsWith("applied ")).map((line) => line.slice(8))).sort();
    expect(applied).toEqual([...REQUIRED_MIGRATIONS]);
    const db = await client(url);
    try { expect(await isSchemaReady(db)).toBe(true); } finally { await db.end(); }
  }, 30_000);

  it("serializes overlapping slow migration runs and skips committed files on retry", async () => {
    const url = await database();
    const directory = await fixture({ "001.sql": "SELECT pg_sleep(0.3); CREATE TABLE public.once_only (id integer);" });
    const a = await client(url), b = await client(url);
    const applied: string[] = [];
    try {
      await Promise.all([a, b].map((db) => runMigrations(db, { directory, onApplied: (filename) => { applied.push(filename); } })));
      expect(applied).toEqual(["001.sql"]);
      await runMigrations(b, { directory, onApplied: () => { throw new Error("Already applied"); } });
      expect((await b.query("SELECT filename FROM public.schema_migrations")).rows).toEqual([{ filename: "001.sql" }]);
    } finally { await a.end(); await b.end(); }
  });

  it("rolls back a failed file, preserves earlier commits, releases its lock and allows repair", async () => {
    const url = await database();
    const directory = await fixture({
      "001.sql": "CREATE TABLE public.kept (id integer);",
      "002.sql": "CREATE TABLE public.rolled_back (id integer); SELECT 1/0;",
    });
    const a = await client(url), b = await client(url);
    try {
      await expect(runMigrations(a, { directory })).rejects.toThrow();
      expect((await b.query("SELECT filename FROM public.schema_migrations")).rows).toEqual([{ filename: "001.sql" }]);
      expect((await b.query("SELECT to_regclass('public.rolled_back') AS name")).rows[0].name).toBeNull();
      expect((await b.query("SELECT pg_try_advisory_lock($1, $2) AS locked", MIGRATION_LOCK_KEYS)).rows[0].locked).toBe(true);
      await b.query("SELECT pg_advisory_unlock($1, $2)", MIGRATION_LOCK_KEYS);
      await writeFile(path.join(directory, "002.sql"), "CREATE TABLE public.rolled_back (id integer);");
      await runMigrations(b, { directory });
      expect((await b.query("SELECT count(*)::integer AS count FROM public.schema_migrations")).rows[0].count).toBe(2);
    } finally { await a.end(); await b.end(); }
  });

  it("a lock timeout writes no migration metadata or schema", async () => {
    const url = await database();
    const directory = await fixture({ "001.sql": "CREATE TABLE public.must_not_exist(id integer);" });
    const holder = await client(url), contender = await client(url);
    try {
      await holder.query("SELECT pg_advisory_lock($1, $2)", MIGRATION_LOCK_KEYS);
      await expect(runMigrations(contender, { directory, lockWaitMs: 0 })).rejects.toThrow("Migration lock wait timed out");
      expect((await contender.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0].name).toBeNull();
      expect((await contender.query("SELECT to_regclass('public.must_not_exist') AS name")).rows[0].name).toBeNull();
    } finally { await holder.end(); await contender.end(); }
  });

  it("fails for absent history or a hole despite the latest filename; accepts a newer schema", async () => {
    const db = await client(await database());
    try {
      await expect(isSchemaReady(db)).rejects.toThrow();
      await db.query("CREATE TABLE public.schema_migrations(filename text PRIMARY KEY)");
      await db.query("INSERT INTO public.schema_migrations VALUES($1)", [REQUIRED_MIGRATIONS.at(-1)]);
      expect(await isSchemaReady(db)).toBe(false);
      for (const name of REQUIRED_MIGRATIONS.slice(0, -1)) await db.query("INSERT INTO public.schema_migrations VALUES($1)", [name]);
      await db.query("INSERT INTO public.schema_migrations VALUES('999_future.sql')");
      expect(await isSchemaReady(db)).toBe(true);
      await db.query("DELETE FROM public.schema_migrations WHERE filename=$1", [REQUIRED_MIGRATIONS[1]]);
      expect(await isSchemaReady(db)).toBe(false);
    } finally { await db.end(); }
  });
});
