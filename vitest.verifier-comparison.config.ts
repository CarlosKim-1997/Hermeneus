import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["live-tests/verifier-model-comparison.test.ts"],
    fileParallelism: false, maxWorkers: 1, testTimeout: 700_000, retry: 0 },
});
