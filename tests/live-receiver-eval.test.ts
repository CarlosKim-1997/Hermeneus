import { describe, expect, it } from "vitest";
import { readOpenAiExtractionConfig } from "../src/llm/openai/config.js";
import { interpretPublished } from "../src/receiver/interpret.js";
import { authorityFromReceiverView } from "../src/receiver/interpretation-authority.js";
import { createOpenAiReceiverSemanticInterpreter } from "../src/receiver/semantic/openai-semantic-interpreter.js";
import { validateInterpretationProposal } from "../src/receiver/semantic/validate-proposal.js";
import { renderInterpretationAnswer } from "../src/receiver/semantic/render-answer.js";
import { semanticEvalCases } from "./receiver/semantic-eval-fixtures.js";

const configured = readOpenAiExtractionConfig();

type Metrics = {
  classificationAccuracy: number;
  citationAccuracy: number;
  falseSupported: number;
  falseOpen: number;
  missedSupported: number;
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
  describe.skip("live Receiver semantic evaluation", () => {});
} else {
  describe("live Receiver semantic evaluation", () => {
    const interpreter = createOpenAiReceiverSemanticInterpreter(configured);
    const metrics: Metrics = {
      classificationAccuracy: 0,
      citationAccuracy: 0,
      falseSupported: 0,
      falseOpen: 0,
      missedSupported: 0,
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

        const proposal = await interpreter.interpret({ question: testCase.question, items: testCase.items });
        const validated = validateInterpretationProposal(proposal, testCase.items);
        expect(validated.ok).toBe(true);
        const live = renderInterpretationAnswer(
          proposal.classification,
          proposal.citationIds,
          testCase.items,
          testCase.question,
        );

        const expectedClass = testCase.expectedClassification;
        const scored = scoreCase(
          expectedClass,
          live.classification,
          testCase.expectedCitationIds,
          live.citations,
        );
        total += 1;
        if (scored.classOk) classHits += 1;
        if (scored.citationOk) citationHits += 1;
        metrics.falseSupported += scored.falseSupported ? 1 : 0;
        metrics.falseOpen += scored.falseOpen ? 1 : 0;
        metrics.missedSupported += scored.missed ? 1 : 0;

        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            id: testCase.id,
            deterministic: deterministic.classification,
            live: live.classification,
            expected: expectedClass,
            deterministicCitations: deterministic.citations,
            liveCitations: live.citations,
          }),
        );

        expect(live.classification).toBe(expectedClass);
        if (testCase.expectedCitationIds) {
          expect(live.citations.sort()).toEqual([...testCase.expectedCitationIds].sort());
        }
        if (testCase.id === "Q5") {
          expect(live.answer.toLowerCase()).toMatch(/tentative/);
        }
        if (testCase.rawTranscriptSecret) {
          expect(JSON.stringify(live)).not.toContain(testCase.rawTranscriptSecret);
        }
      }, 120_000);
    }

    it("reports semantic evaluation metrics", () => {
      metrics.classificationAccuracy = total ? classHits / total : 0;
      metrics.citationAccuracy = total ? citationHits / total : 0;
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ metrics, total, classHits, citationHits }));
      expect(total).toBe(semanticEvalCases.length);
    });
  });
}
