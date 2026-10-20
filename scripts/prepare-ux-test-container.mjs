// Run only inside the disposable official Playwright Linux test container.
import { spawnSync } from "node:child_process";
import { realpathSync, writeFileSync } from "node:fs";
if (process.platform !== "linux") throw new Error("Disposable Linux fixture container required.");
const run = (command, args, capture = false) => {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit" });
  if (result.status !== 0) throw new Error("Fixture preparation failed.");
  return result.stdout?.trim();
};
const runtime = run("npm", ["exec", "--yes", "--package=node@22", "--", "node", "-p", "process.execPath"], true);
const npm = realpathSync(run("which", ["npm"], true));
run(runtime, [npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
writeFileSync(".fixture-node22", runtime);
run(runtime, ["--version"]);
