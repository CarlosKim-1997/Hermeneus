import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/receiver/answer-grounding.test.ts"],
    testTimeout: 30_000,
  },
});
