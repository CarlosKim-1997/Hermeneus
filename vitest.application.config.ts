import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/application/**/*.test.ts"],
    fileParallelism: false,
  },
});
