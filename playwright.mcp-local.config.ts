import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"mcp-browser-tests",workers:1,timeout:30_000,reporter:"list",outputDir:"test-results/mcp-local",use:{trace:"off",screenshot:"only-on-failure"}});
