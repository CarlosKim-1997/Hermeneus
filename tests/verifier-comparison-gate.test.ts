import { describe, expect, it } from "vitest";
import { validateComparisonRun } from "../scripts/verifier-comparison-gate.mjs";
const sha = "a".repeat(40);
const run = { repository: "CarlosKim-1997/Hermeneus", ref: "refs/heads/main", sha, runId: "123", attempt: "1" };
const history = { total_count: 1, workflow_runs: [{ id: 123, head_sha: sha, run_attempt: 1 }] };
describe("single-use paid comparison gate", () => {
  it("accepts only the first trusted current-main campaign", () => {
    expect(() => validateComparisonRun(run, history, sha)).not.toThrow();
  });
  it("denies repeated, foreign, stale and ambiguous runs", () => {
    for (const args of [
      [{ ...run, attempt: "2" }, history, sha],
      [{ ...run, repository: "attacker/Hermeneus" }, history, sha],
      [{ ...run, ref: "refs/heads/topic" }, history, sha],
      [run, history, "b".repeat(40)],
      [run, { ...history, total_count: 2 }, sha],
      [run, { ...history, workflow_runs: [{ ...history.workflow_runs[0], id: 124 }] }, sha],
    ] as const) expect(() => validateComparisonRun(args[0], args[1], args[2])).toThrow();
  });
});
