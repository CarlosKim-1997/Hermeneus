import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/extraction/**/*.test.ts"],
  },
});
