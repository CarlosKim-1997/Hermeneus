import { describe, expect, it } from "vitest";
import { interpretReceiverQuestion } from "../src/application/receiver-interpretation.js";
import { readOpenAiExtractionConfig } from "../src/llm/openai/config.js";
import { interpretPublished } from "../src/receiver/interpret.js";
import { authorityFromReceiverView } from "../src/receiver/interpretation-authority.js";
import { createOpenAiReceiverSemanticInterpreter } from "../src/receiver/semantic/openai-semantic-interpreter.js";
import { semanticEvalCases } from "./receiver/semantic-eval-fixtures.js";

const configured = readOpenAiExtractionConfig();

type Metrics = {
  classificationAccuracy: number;
  citationAccuracy: number;
  falseSupported: number;
  falseOpen: number;
  missedSupported: number;
  unexpectedFallbacks: number;
};

function scoreCase(
  expected: string,
  liveClassification: string,
  expectedCitations: string[] | undefined,
  liveCitations: string[],
): { classOk: boolean; citationOk: boolean; falseSupported: boolean; falseOpen: boolean; missed: boolean } {
  const classOk = liveClassification === expected;
  const citationOk =
    expectedCitations === undefined
      ? true
      : [...expectedCitations].sort().join(",") === [...liveCitations].sort().join(",");
  const falseSupported = !classOk && liveClassification === "SUPPORTED" && expected === "UNKNOWN";
  const falseOpen = !classOk && liveClassification === "OPEN" && expected === "UNKNOWN";
  const missed = !classOk && expected === "SUPPORTED" && liveClassification === "UNKNOWN";
  return { classOk, citationOk, falseSupported, falseOpen, missed };
}

if (!configured) {
  describe.skip("Hybrid Receiver live evaluation", () => {});
} else {
  describe("Hybrid Receiver live evaluation", () => {
    const interpreter = createOpenAiReceiverSemanticInterpreter(configured);
    const metrics: Metrics = {
      classificationAccuracy: 0,
      citationAccuracy: 0,
      falseSupported: 0,
      falseOpen: 0,
      missedSupported: 0,
      unexpectedFallbacks: 0,
    };
    let total = 0;
    let classHits = 0;
    let citationHits = 0;

    for (const testCase of semanticEvalCases) {
      it(`${testCase.id} — ${testCase.question}`, async () => {
        const view = {
          handoffId: "eval-handoff",
          version: 1,
          publishedAt: "2026-09-26T00:00:00.000Z",
          items: testCase.items,
        };
        const authority = authorityFromReceiverView(view);
        const deterministic = interpretPublished(testCase.question, authority);

        const hybrid = await interpretReceiverQuestion(testCase.question, authority, interpreter);

        const expectedClass = testCase.expectedClassification;
        const scored = scoreCase(
          expectedClass,
          hybrid.classification,
          testCase.expectedCitationIds,
          hybrid.citations,
        );
        total += 1;
        if (scored.classOk) classHits += 1;
        if (scored.citationOk) citationHits += 1;
        metrics.falseSupported += scored.falseSupported ? 1 : 0;
        metrics.falseOpen += scored.falseOpen ? 1 : 0;
        metrics.missedSupported += scored.missed ? 1 : 0;
        if (hybrid.interpretationMode !== "semantic") {
          metrics.unexpectedFallbacks += 1;
        }

        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            id: testCase.id,
            deterministic: deterministic.classification,
            hybridLive: hybrid.classification,
            expected: expectedClass,
            interpretationMode: hybrid.interpretationMode,
            deterministicCitations: deterministic.citations,
            hybridCitations: hybrid.citations,
          }),
        );

        expect(hybrid.interpretationMode).toBe("semantic");
        expect(hybrid.classification).toBe(expectedClass);
        if (testCase.expectedCitationIds) {
          expect(hybrid.citations.sort()).toEqual([...testCase.expectedCitationIds].sort());
        }
        if (testCase.id === "Q5") {
          expect(hybrid.answer.toLowerCase()).toMatch(/tentative/);
        }
        if (testCase.rawTranscriptSecret) {
          expect(JSON.stringify(hybrid)).not.toContain(testCase.rawTranscriptSecret);
        }
      }, 120_000);
    }

    it("reports Hybrid Receiver live evaluation metrics", () => {
      metrics.classificationAccuracy = total ? classHits / total : 0;
      metrics.citationAccuracy = total ? citationHits / total : 0;
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ metrics, total, classHits, citationHits }));
      expect(total).toBe(semanticEvalCases.length);
      expect(metrics.unexpectedFallbacks).toBe(0);
    });
  });
}
