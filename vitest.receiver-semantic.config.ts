import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/receiver/openai-semantic-adapter.test.ts"],
    testTimeout: 30_000,
  },
});
