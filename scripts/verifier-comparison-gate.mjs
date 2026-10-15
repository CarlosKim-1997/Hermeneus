import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REPOSITORY, selectCommit } from "./alpha-release-gate.mjs";

export function validateComparisonRun({ repository, ref, sha, runId, attempt }, history, trustedSha) {
  if (repository !== REPOSITORY || ref !== "refs/heads/main" || attempt !== "1" ||
      !/^[a-f0-9]{40}$/.test(sha) || sha !== trustedSha ||
      history.total_count !== 1 || history.workflow_runs?.length !== 1 ||
      String(history.workflow_runs[0].id) !== runId || history.workflow_runs[0].head_sha !== sha ||
      history.workflow_runs[0].run_attempt !== 1) throw new Error("Comparison gate denied.");
}

async function get(path) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
    redirect: "manual", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Comparison API gate denied.");
  return response.json();
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  const ciId = event.inputs?.ci_run_id;
  if (!/^\d+$/.test(ciId ?? "")) throw new Error("CI run ID missing.");
  const ci = await get(`actions/runs/${ciId}`);
  const trustedSha = await selectCommit({ repository: { full_name: REPOSITORY },
    workflow_run: { id: ci.id, run_attempt: ci.run_attempt } }, process.env.GITHUB_TOKEN);
  const history = await get("actions/workflows/verifier-comparison.yml/runs?event=workflow_dispatch&per_page=100");
  validateComparisonRun({ repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT }, history, trustedSha);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error("Comparison gate stopped. Inspect run state before any retry."); process.exitCode = 1; });
}
