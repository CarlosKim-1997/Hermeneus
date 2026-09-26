import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/live-receiver.test.ts"],
    testTimeout: 120_000,
  },
});
