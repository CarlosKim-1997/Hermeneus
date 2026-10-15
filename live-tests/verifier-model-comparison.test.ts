import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { COMPARISON_MODELS, createOpenAiExternalVerifier, type VerifierUsage } from "../src/receiver/external/openai-verifier.js";
import { comparisonFixtures, comparisonPacket } from "../src/receiver/external/comparison-fixtures.js";
import { aggregateVerdict } from "../src/receiver/external/verifier.js";

// Never included in ordinary CI. Use a dedicated project key already in the
// execution environment. Do not pull a Vercel Secret or print provider errors.
describe.skipIf(process.env.RUN_VERIFIER_COMPARISON !== "1")("T-026 live synthetic comparison", () => {
  it("compares identical fixtures in at most 20 generation calls", async () => {
    if (!process.env.OPENAI_VERIFIER_API_KEY?.trim()) throw new Error("Dedicated verifier key missing.");
    if (process.env.VERIFIER_PROJECT_SPEND_CAP_CONFIRMED !== "1") throw new Error("Confirm dedicated project spend cap first.");
    const directory = "work/.verifier-comparison";
    const ledger = `${directory}/t026.json`;
    await mkdir(directory, { recursive: true });
    const state = { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      startedAt: new Date().toISOString(), reservedCents: 0, complete: false, rows: [] as Array<{
        fixture: string; model: string; expected: string; critical: boolean; verdict?: string;
        elapsedMs?: number; usage?: VerifierUsage; estimatedCostUpperUsd?: number; status: string;
      }> };
    // Single-use persistent campaign marker. A rerun refuses to spend again.
    // Unknown outcomes count as spent; never delete this file to retry blindly.
    await writeFile(ledger, JSON.stringify(state, null, 2), { flag: "wx" });
    const save = () => writeFile(ledger, JSON.stringify(state, null, 2));
    for (const [index, fixture] of comparisonFixtures.entries()) {
      const models = index % 2 ? [...COMPARISON_MODELS].reverse() : [...COMPARISON_MODELS];
      for (const model of models) {
        const row: typeof state.rows[number] = { fixture: fixture.id, model, expected: fixture.expected, critical: fixture.critical, status: "prepared" };
        state.rows.push(row);
        const started = performance.now();
        const verifier = createOpenAiExternalVerifier(process.env.OPENAI_VERIFIER_API_KEY.trim(), {
          model,
          reserve: async () => {
            if (state.reservedCents + 5 > 100 || state.rows.length > 20) throw new Error("Campaign limit reached.");
            state.reservedCents += 5;
            row.status = "reserved";
            await save(); // Persist before dispatch, including interrupted calls.
          },
          observeUsage: (usage) => {
            row.usage = usage;
            const prices = model === "gpt-6-luna" ? [0.125, 0.50] : [2.50, 10];
            row.estimatedCostUpperUsd = (usage.inputTokens * prices[0]! + usage.outputTokens * prices[1]!) / 1_000_000;
            if (usage.serviceTier !== "default" || row.estimatedCostUpperUsd > .05) throw new Error("Unexpected billing boundary.");
          },
        });
        const submission = { protocol: "hermeneus.receiver-submission/v0" as const,
          publicationRef: comparisonPacket.publicationRef, packetDigest: comparisonPacket.canonicalDigest,
          answerText: fixture.answer };
        try {
          const analysis = await verifier.analyze({ packet: comparisonPacket, submission });
          row.verdict = aggregateVerdict(comparisonPacket, submission, analysis).verdict;
          row.status = "completed";
        } catch {
          row.status = "failed-or-unknown";
          row.elapsedMs = Math.round(performance.now() - started);
          await save();
          throw new Error("Comparison stopped; inspect sanitized campaign ledger before any further call.");
        }
        row.elapsedMs = Math.round(performance.now() - started);
        await save();
        if (fixture.critical && row.verdict === "ALIGNED") throw new Error("Critical false alignment; comparison stopped.");
      }
    }
    state.complete = true;
    await save();
    expect(JSON.parse(await readFile(ledger, "utf8")).rows).toHaveLength(20);
    // Ledger records only fixture IDs, verdicts and usage. Provider explanations,
    // raw prompts, answers, credentials and bearer links are never persisted.
  });
});
