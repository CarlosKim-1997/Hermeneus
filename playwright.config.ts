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
        command: `DATABASE_URL=${databaseUrl} TEST_DATABASE_URL=${databaseUrl} PORT=${port} bash scripts/start-e2e-server.sh`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
});
