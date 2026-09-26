import { defineConfig } from "@playwright/test";

const port = 3100;
const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: databaseUrl
    ? {
        command: `DATABASE_URL=${databaseUrl} TEST_DATABASE_URL=${databaseUrl} HERMENEUS_EXTRACTION_FIXTURE=e2e CREATOR_AUTH_MODE=dev DEV_CREATOR_ID=creator_e2e_a DEV_CREATOR_ID_B=creator_e2e_b CREATOR_SESSION_SECRET=e2e-test-session-secret-minimum-32-chars PORT=${port} bash scripts/start-e2e-server.sh`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
});
