import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"ux-tests",workers:1,timeout:30000,reporter:[["list"]],outputDir:"test-results/ux",use:{baseURL:"http://127.0.0.1:3410",trace:"off",screenshot:"only-on-failure"},webServer:{env:{TZ:"UTC"},command:"node scripts/start-ux-preview.mjs",url:"http://127.0.0.1:3410/library",reuseExistingServer:false,timeout:45000}});
