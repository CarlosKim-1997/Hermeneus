import { describe, expect, it, vi } from "vitest";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { applyGroundedNaturalAnswer } from "../../src/application/grounded-receiver-answer.js";
import { createOpenAiReceiverAnswerGenerator } from "../../src/receiver/answer/openai-answer-generator.js";
import { createOpenAiReceiverGroundingVerifier } from "../../src/receiver/answer/openai-grounding-verifier.js";
import {
  validateGeneratedAnswerProposal,
  validateGroundingVerification,
} from "../../src/receiver/answer/validate-generated-proposal.js";
import type { InterpretationAuthorityItem } from "../../src/receiver/interpretation-authority.js";

const config = { apiKey: "test-key", model: "test-model" };
const selected: InterpretationAuthorityItem[] = [
  { id: "web", type: "CONFIRMED", statement: "The MVP will launch as a browser-based product first.", priority: "CORE" },
];
const allowed = new Set(["web"]);
const interpretationSupported = {
  classification: "SUPPORTED" as const,
  answer: "The MVP will launch as a browser-based product first.",
  citations: ["web"],
  interpretationMode: "semantic" as const,
};

function minimalResponse(overrides: Partial<ParsedResponse<unknown>>): ParsedResponse<unknown> {
  return {
    id: "resp_test",
    object: "response",
    created_at: 0,
    status: "completed",
    error: null,
    incomplete_details: null,
    output: [],
    output_parsed: null,
    output_text: "",
    parallel_tool_calls: true,
    previous_response_id: null,
    reasoning: null,
    store: false,
    temperature: 1,
    text: { format: { type: "text" } },
    tool_choice: "auto",
    tools: [],
    top_p: 1,
    truncation: "disabled",
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    metadata: {},
    model: "test-model",
    instructions: null,
    ...overrides,
  } as ParsedResponse<unknown>;
}

describe("Receiver answer generator validation (GA)", () => {
  it("GA1 — valid one-sentence proposal accepted", () => {
    const result = validateGeneratedAnswerProposal(
      { sentences: [{ text: "Launch is browser-first.", citationIds: ["web"] }] },
      allowed,
    );
    expect(result.ok).toBe(true);
  });

  it("GA2 — citation outside M6 selection rejected", () => {
    const result = validateGeneratedAnswerProposal(
      { sentences: [{ text: "Launch is browser-first.", citationIds: ["other"] }] },
      allowed,
    );
    expect(result.ok).toBe(false);
  });

  it("GA3 — nonexistent ID rejected", () => {
    const result = validateGeneratedAnswerProposal(
      { sentences: [{ text: "x", citationIds: ["missing"] }] },
      allowed,
    );
    expect(result.ok).toBe(false);
  });

  it("GA4 — sentence without citation rejected", () => {
    const result = validateGeneratedAnswerProposal({ sentences: [{ text: "x", citationIds: [] }] }, allowed);
    expect(result.ok).toBe(false);
  });

  it("GA5 — malformed generator output falls back", async () => {
    const generator = createOpenAiReceiverAnswerGenerator(config, {
      client: { responses: { parse: vi.fn(async () => minimalResponse({ output_parsed: { sentences: [] } })) } },
    });
    const verifier = { verify: vi.fn() };
    const outcome = await applyGroundedNaturalAnswer({
      question: "Where are we launching?",
      interpretation: interpretationSupported,
      selectedItems: selected,
      deterministicAnswer: interpretationSupported.answer,
      generator,
      verifier,
    });
    expect(outcome.answerMode).toBe("deterministic");
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("GA6 — generator refusal falls back", async () => {
    const generator = createOpenAiReceiverAnswerGenerator(config, {
      client: {
        responses: {
          parse: vi.fn(async () =>
            minimalResponse({
              output: [
                {
                  id: "m1",
                  type: "message",
                  role: "assistant",
                  status: "completed",
                  content: [{ type: "refusal", refusal: "no" }],
                },
              ],
            }),
          ),
        },
      },
    });
    const outcome = await applyGroundedNaturalAnswer({
      question: "Where are we launching?",
      interpretation: interpretationSupported,
      selectedItems: selected,
      deterministicAnswer: interpretationSupported.answer,
      generator,
      verifier: { verify: vi.fn() },
    });
    expect(outcome.answerMode).toBe("deterministic");
  });

  it("GA7 — generator provider exception falls back via ReceiverAnswerLayerError", async () => {
    const generator = createOpenAiReceiverAnswerGenerator(config, {
      client: { responses: { parse: vi.fn(async () => { throw new Error("network"); }) } },
    });
    const outcome = await applyGroundedNaturalAnswer({
      question: "Where are we launching?",
      interpretation: interpretationSupported,
      selectedItems: selected,
      deterministicAnswer: interpretationSupported.answer,
      generator,
      verifier: { verify: vi.fn() },
    });
    expect(outcome.answerMode).toBe("deterministic");
  });

  it("GA8 — unexpected generator error propagates", async () => {
    await expect(
      applyGroundedNaturalAnswer({
        question: "q",
        interpretation: interpretationSupported,
        selectedItems: selected,
        deterministicAnswer: "d",
        generator: { generate: vi.fn(async () => { throw new Error("unexpected implementation defect"); }) },
        verifier: { verify: vi.fn() },
      }),
    ).rejects.toThrow("unexpected implementation defect");
  });
});

describe("Receiver grounding verifier (GV)", () => {
  const proposal = { sentences: [{ text: "Browser-first launch.", citationIds: ["web"] }] };

  it("GV1 — all sentences grounded allows generated answer", async () => {
    const generator = { generate: vi.fn(async () => proposal) };
    const verifier = {
      verify: vi.fn(async () => ({
        verdict: "GROUNDED" as const,
        sentenceResults: [{ index: 0, grounded: true, citationIds: ["web"] }],
      })),
    };
    const outcome = await applyGroundedNaturalAnswer({
      question: "Where first?",
      interpretation: interpretationSupported,
      selectedItems: selected,
      deterministicAnswer: interpretationSupported.answer,
      generator,
      verifier,
    });
    expect(outcome.answerMode).toBe("generated-grounded");
  });

  it("GV2 — one unsupported sentence discards generated answer", async () => {
    const outcome = await applyGroundedNaturalAnswer({
      question: "Where first?",
      interpretation: interpretationSupported,
      selectedItems: selected,
      deterministicAnswer: interpretationSupported.answer,
      generator: { generate: vi.fn(async () => proposal) },
      verifier: {
        verify: vi.fn(async () => ({
          verdict: "UNSUPPORTED" as const,
          sentenceResults: [{ index: 0, grounded: false, citationIds: ["web"] }],
        })),
      },
    });
    expect(outcome.answerMode).toBe("deterministic");
    expect(outcome.answer).toBe(interpretationSupported.answer);
  });

  it("GV3 — verifier evidence outside selected set rejected", () => {
    const ok = validateGroundingVerification(
      { verdict: "GROUNDED", sentenceResults: [{ index: 0, grounded: true, citationIds: ["other"] }] },
      proposal,
      allowed,
    );
    expect(ok).toBe(false);
  });

  it("GV4 — malformed verifier output falls back", async () => {
    const verifier = createOpenAiReceiverGroundingVerifier(config, {
      client: { responses: { parse: vi.fn(async () => minimalResponse({ output_parsed: { verdict: "GROUNDED" } })) } },
    });
    const outcome = await applyGroundedNaturalAnswer({
      question: "q",
      interpretation: interpretationSupported,
      selectedItems: selected,
      deterministicAnswer: interpretationSupported.answer,
      generator: { generate: vi.fn(async () => proposal) },
      verifier,
    });
    expect(outcome.answerMode).toBe("deterministic");
  });

  it("GV5 — verifier provider failure falls back", async () => {
    const verifier = createOpenAiReceiverGroundingVerifier(config, {
      client: { responses: { parse: vi.fn(async () => { throw new Error("down"); }) } },
    });
    const outcome = await applyGroundedNaturalAnswer({
      question: "q",
      interpretation: interpretationSupported,
      selectedItems: selected,
      deterministicAnswer: interpretationSupported.answer,
      generator: { generate: vi.fn(async () => proposal) },
      verifier,
    });
    expect(outcome.answerMode).toBe("deterministic");
  });

  it("GV6 — unexpected verifier error propagates", async () => {
    await expect(
      applyGroundedNaturalAnswer({
        question: "q",
        interpretation: interpretationSupported,
        selectedItems: selected,
        deterministicAnswer: "d",
        generator: { generate: vi.fn(async () => proposal) },
        verifier: { verify: vi.fn(async () => { throw new Error("unexpected implementation defect"); }) },
      }),
    ).rejects.toThrow("unexpected implementation defect");
  });

  it("fabricated React claim is rejected by verifier gate", async () => {
    const badProposal = {
      sentences: [{ text: "The MVP is web-first and will use React.", citationIds: ["web"] }],
    };
    const outcome = await applyGroundedNaturalAnswer({
      question: "Where are we launching?",
      interpretation: interpretationSupported,
      selectedItems: selected,
      deterministicAnswer: interpretationSupported.answer,
      generator: { generate: vi.fn(async () => badProposal) },
      verifier: {
        verify: vi.fn(async () => ({
          verdict: "UNSUPPORTED" as const,
          sentenceResults: [{ index: 0, grounded: false, citationIds: ["web"] }],
        })),
      },
    });
    expect(outcome.answer).toBe(interpretationSupported.answer);
    expect(outcome.answer).not.toMatch(/React/);
  });

  it("price invention falls back when verifier returns UNSUPPORTED", async () => {
    const pricingItem = [{ id: "plan", type: "CONFIRMED" as const, statement: "The paid plan is under consideration.", priority: "CORE" as const }];
    const outcome = await applyGroundedNaturalAnswer({
      question: "What will it cost?",
      interpretation: { ...interpretationSupported, citations: ["plan"] },
      selectedItems: pricingItem,
      deterministicAnswer: "The paid plan is under consideration.",
      generator: {
        generate: vi.fn(async () => ({
          sentences: [{ text: "The paid plan will cost $20 per month.", citationIds: ["plan"] }],
        })),
      },
      verifier: {
        verify: vi.fn(async () => ({
          verdict: "UNSUPPORTED" as const,
          sentenceResults: [{ index: 0, grounded: false, citationIds: ["plan"] }],
        })),
      },
    });
    expect(outcome.answerMode).toBe("deterministic");
    expect(outcome.answer).not.toMatch(/\$20/);
  });

  it("OPEN classification bypasses generator", async () => {
    const gen = vi.fn();
    const outcome = await applyGroundedNaturalAnswer({
      question: "q",
      interpretation: { classification: "OPEN", answer: "open", citations: ["o"], interpretationMode: "semantic" },
      selectedItems: [{ id: "o", type: "OPEN", statement: "Unresolved.", priority: "CORE" }],
      deterministicAnswer: "open",
      generator: { generate: gen },
      verifier: { verify: vi.fn() },
    });
    expect(gen).not.toHaveBeenCalled();
    expect(outcome.answerMode).toBe("deterministic");
  });
});
