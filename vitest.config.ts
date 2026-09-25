import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**", "tests/application/**", "tests/extraction/**", "tests/live-extraction.test.ts"],
  },
});
