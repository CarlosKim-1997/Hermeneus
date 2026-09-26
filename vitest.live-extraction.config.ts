import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/live-extraction.test.ts"],
    testTimeout: 120_000,
  },
});
