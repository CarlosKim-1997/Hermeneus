import { describe, expect, it, vi } from "vitest";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { createOpenAiHandoffExtractor } from "../../src/extraction/model-backed-extractor.js";
import type { NormalizedConversation } from "../../src/import/types.js";

const conversation: NormalizedConversation = {
  id: "conv-o",
  source: { provider: "generic-text", importedAt: "2026-09-25T00:00:00.000Z" },
  messages: [
    {
      id: "conv-o:c1",
      role: "creator",
      content: "Web-first is confirmed.",
      source: { provider: "generic-text" },
    },
  ],
};

const config = { apiKey: "test-key", model: "test-model" };

function fakeClient(parseImpl: () => Promise<ParsedResponse<unknown>>) {
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

describe("OpenAI extraction adapter edge cases", () => {
  it("O1 — refusal maps to MODEL_REFUSAL", async () => {
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

    const extractor = createOpenAiHandoffExtractor(config, { client });
    await expect(extractor.extract(conversation)).rejects.toMatchObject({
      code: "MODEL_REFUSAL",
    });
  });

  it("O2 — incomplete response maps to MODEL_OUTPUT_INVALID", async () => {
    const { client } = fakeClient(async () =>
      minimalResponse({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      }),
    );

    const extractor = createOpenAiHandoffExtractor(config, { client });
    await expect(extractor.extract(conversation)).rejects.toMatchObject({
      code: "MODEL_OUTPUT_INVALID",
    });
  });

  it("O3 — completed response without parsed payload maps to MODEL_OUTPUT_INVALID", async () => {
    const { client } = fakeClient(async () => minimalResponse({ output_parsed: null }));

    const extractor = createOpenAiHandoffExtractor(config, { client });
    await expect(extractor.extract(conversation)).rejects.toMatchObject({
      code: "MODEL_OUTPUT_INVALID",
    });
  });

  it("O4 — provider exception maps to MODEL_PROVIDER_ERROR", async () => {
    const { client } = fakeClient(async () => {
      throw new Error("network down");
    });

    const extractor = createOpenAiHandoffExtractor(config, { client });
    await expect(extractor.extract(conversation)).rejects.toMatchObject({
      code: "MODEL_PROVIDER_ERROR",
    });
  });
});
