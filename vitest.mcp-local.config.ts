import { defineConfig } from "vitest/config";
export default defineConfig({test:{environment:"node",include:["tests/integration/mcp-scoped.test.ts"],fileParallelism:false}});
