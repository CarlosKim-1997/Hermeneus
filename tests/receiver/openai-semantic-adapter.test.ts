import { describe, expect, it, vi } from "vitest";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { createOpenAiReceiverSemanticInterpreter } from "../../src/receiver/semantic/openai-semantic-interpreter.js";
import type { InterpretationAuthorityItem } from "../../src/receiver/interpretation-authority.js";
import { interpretReceiverQuestion } from "../../src/application/receiver-interpretation.js";
import { authorityFromReceiverView } from "../../src/receiver/interpretation-authority.js";
import { validateInterpretationProposal } from "../../src/receiver/semantic/validate-proposal.js";
import { renderInterpretationAnswer } from "../../src/receiver/semantic/render-answer.js";

const items: InterpretationAuthorityItem[] = [
  { id: "web", type: "CONFIRMED", statement: "Web-first is confirmed.", priority: "CORE" },
];

const config = { apiKey: "test-key", model: "test-model" };
const SECRET = "SECRET RAW TRANSCRIPT MARKER";

function fakeClient(parseImpl: (body: unknown) => Promise<ParsedResponse<unknown>>) {
  return {
    client: {
      responses: {
        parse: vi.fn(parseImpl),
      },
    },
  };
}

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

describe("OpenAI Receiver semantic adapter", () => {
  it("RO1 — valid SUPPORTED proposal parses and renders Hermeneus answer", async () => {
    const { client } = fakeClient(async () =>
      minimalResponse({
        output_parsed: { classification: "SUPPORTED", citationIds: ["web"] },
      }),
    );
    const interpreter = createOpenAiReceiverSemanticInterpreter(config, { client });
    const proposal = await interpreter.interpret({ question: "Are we web first?", items });
    const validated = validateInterpretationProposal(proposal, items);
    expect(validated.ok).toBe(true);
    const rendered = renderInterpretationAnswer("SUPPORTED", ["web"], items, "Are we web first?");
    expect(rendered.classification).toBe("SUPPORTED");
    expect(rendered.answer).toMatch(/Web-first is confirmed/);
  });

  it("RO2 — unknown cited ID rejected by validator", () => {
    const result = validateInterpretationProposal({ classification: "SUPPORTED", citationIds: ["missing"] }, items);
    expect(result.ok).toBe(false);
  });

  it("RO3 — OPEN without OPEN citation rejected", () => {
    const result = validateInterpretationProposal({ classification: "OPEN", citationIds: ["web"] }, items);
    expect(result.ok).toBe(false);
  });

  it("RO4 — UNKNOWN with citations rejected", () => {
    const result = validateInterpretationProposal({ classification: "UNKNOWN", citationIds: ["web"] }, items);
    expect(result.ok).toBe(false);
  });

  it("RO5 — refusal maps to provider failure and deterministic fallback", async () => {
    const { client } = fakeClient(async () =>
      minimalResponse({
        output: [
          {
            id: "msg_1",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{ type: "refusal", refusal: "Declined." }],
          },
        ],
      }),
    );
    const interpreter = createOpenAiReceiverSemanticInterpreter(config, { client });
    const authority = authorityFromReceiverView({
      handoffId: "h",
      version: 1,
      publishedAt: "2026-09-26T00:00:00.000Z",
      items,
    });
    const result = await interpretReceiverQuestion("Are we web first?", authority, interpreter);
    expect(result.interpretationMode).toBe("deterministic");
    expect(result.interpretationNotice).toMatch(/Semantic interpretation was unavailable/);
  });

  it("RO6 — malformed structured output rejected", async () => {
    const { client } = fakeClient(async () =>
      minimalResponse({
        output_parsed: { classification: "SUPPORTED" },
      }),
    );
    const interpreter = createOpenAiReceiverSemanticInterpreter(config, { client });
    const authority = authorityFromReceiverView({
      handoffId: "h",
      version: 1,
      publishedAt: "2026-09-26T00:00:00.000Z",
      items,
    });
    const result = await interpretReceiverQuestion("Are we web first?", authority, interpreter);
    expect(result.interpretationNotice).toMatch(/Semantic interpretation was unavailable/);
  });

  it("RO7 — provider exception uses fallback path via ReceiverSemanticError", async () => {
    const { client } = fakeClient(async () => {
      throw new Error("network down");
    });
    const interpreter = createOpenAiReceiverSemanticInterpreter(config, { client });
    const authority = authorityFromReceiverView({
      handoffId: "h",
      version: 1,
      publishedAt: "2026-09-26T00:00:00.000Z",
      items,
    });
    const result = await interpretReceiverQuestion("Are we web first?", authority, interpreter);
    expect(result.interpretationMode).toBe("deterministic");
    expect(result.interpretationNotice).toMatch(/Semantic interpretation was unavailable/);
  });

  it("RO9 — unexpected interpreter error is not silently swallowed", async () => {
    const interpreter = {
      interpret: vi.fn(async () => {
        throw new Error("unexpected implementation defect");
      }),
    };
    const authority = authorityFromReceiverView({
      handoffId: "h",
      version: 1,
      publishedAt: "2026-09-26T00:00:00.000Z",
      items,
    });
    await expect(interpretReceiverQuestion("Are we web first?", authority, interpreter)).rejects.toThrow(
      "unexpected implementation defect",
    );
  });

  it("RO10 — deterministic DERIVED bypasses semantic model", async () => {
    const derivedItems: InterpretationAuthorityItem[] = [
      {
        id: "search-off",
        type: "CONSTRAINT",
        statement: "Web search is disabled for the Receiver agent.",
        priority: "CORE",
      },
    ];
    const interpretSpy = vi.fn(async () => ({
      classification: "SUPPORTED" as const,
      citationIds: ["search-off"],
    }));
    const authority = authorityFromReceiverView({
      handoffId: "h",
      version: 1,
      publishedAt: "2026-09-26T00:00:00.000Z",
      items: derivedItems,
    });
    const result = await interpretReceiverQuestion(
      "Will the Receiver browse the web?",
      authority,
      { interpret: interpretSpy },
    );
    expect(result.classification).toBe("DERIVED");
    expect(interpretSpy).toHaveBeenCalledTimes(0);
  });

  it("RO8 — model payload excludes raw source and provenance markers", async () => {
    const { client } = fakeClient(async (body) => {
      const record = body as { input?: Array<{ content?: unknown }> };
      const userContent = JSON.stringify(record.input?.[1]?.content ?? "");
      expect(userContent).toContain("Are we web first?");
      expect(userContent).toContain("Web-first is confirmed.");
      expect(userContent).not.toContain(SECRET);
      expect(userContent).not.toMatch(/messageId|NormalizedConversation|"excerpt"|source_messages/i);
      return minimalResponse({ output_parsed: { classification: "SUPPORTED", citationIds: ["web"] } });
    });
    const interpreter = createOpenAiReceiverSemanticInterpreter(config, { client });
    const rawOnlySecret = SECRET;
    expect(rawOnlySecret.length).toBeGreaterThan(0);
    await interpreter.interpret({
      question: "Are we web first?",
      items,
    });
  });
});
