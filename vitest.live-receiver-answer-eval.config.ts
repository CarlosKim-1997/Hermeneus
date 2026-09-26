import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/live-receiver-answer-eval.test.ts"],
    testTimeout: 180_000,
  },
});
