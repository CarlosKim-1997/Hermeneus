import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is required for E2E`);
    process.exit(2);
  }
  return value;
}

const databaseUrl = requireEnv("DATABASE_URL");
requireEnv("TEST_DATABASE_URL");

const port = process.env.PORT?.trim() || "3100";

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL?.trim() || databaseUrl,
  PORT: port,
  CREATOR_AUTH_MODE: "dev",
  DEV_CREATOR_ID: "creator_e2e_a",
  DEV_CREATOR_ID_B: "creator_e2e_b",
  CREATOR_SESSION_SECRET: "e2e-test-session-secret-minimum-32-chars",
  HERMENEUS_EXTRACTION_FIXTURE: "e2e",
};

const migrate = spawnSync(process.execPath, [path.join(root, "scripts", "migrate.mjs")], {
  env,
  stdio: "inherit",
  cwd: root,
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", "-p", port], {
  env,
  stdio: "inherit",
  cwd: root,
});

function shutdown(code = 0) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
  process.exit(code);
}

child.on("error", (error) => {
  console.error(error.message);
  shutdown(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));
