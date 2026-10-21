import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Dedicated disposable-database runner enforces its own target guard.
    exclude: ["tests/integration/mcp-scoped.test.ts", "tests/integration/mcp-oauth.test.ts"],
    fileParallelism: false,
  },
});
