import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runMigrations } from "./migration-runner.mjs";

const { Client } = pg;
const root = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(root, "..", "migrations");

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL or TEST_DATABASE_URL is required");
    process.exit(2);
  }

  // Session advisory locks cannot safely span transaction-pooler connections.
  const target = new URL(databaseUrl);
  const supabasePooler = target.hostname.endsWith(".pooler.supabase.com") ||
    (target.hostname.startsWith("db.") && target.hostname.endsWith(".supabase.co"));
  if (supabasePooler && target.port === "6543") {
    throw new Error("Migrations require a direct or session connection");
  }
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000,
    application_name: "hermeneus-migrator" });
  await client.connect();
  try {
    await runMigrations(client, { directory: migrationsDir,
      onApplied: (filename) => console.log(`applied ${filename}`) });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // Do not echo connection strings, server details, or SQL data into deploy logs.
  const code = typeof error?.code === "string" && /^[0-9A-Z]{5}$/.test(error.code) ? ` (${error.code})` : "";
  console.error(`Migration failed${code}. Check connectivity, the dedicated connection, migration SQL, and competing migrators.`);
  process.exit(1);
});
