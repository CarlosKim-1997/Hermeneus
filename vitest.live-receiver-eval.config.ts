import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/live-receiver-eval.test.ts"],
    testTimeout: 120_000,
  },
});
