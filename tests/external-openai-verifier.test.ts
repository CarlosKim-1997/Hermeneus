import { describe, expect, it, vi } from "vitest";
import type { ParsedResponse } from "openai/resources/responses/responses";
import type OpenAI from "openai";
import { buildReceiverPacket, type ReceiverSubmission } from "../src/portable/receiver-packet.js";
import { createOpenAiExternalVerifier, PILOT_MAX_INPUT_BYTES, PILOT_MAX_OUTPUT_TOKENS, PILOT_VERIFIER_MODEL } from "../src/receiver/external/openai-verifier.js";

const packet = buildReceiverPacket({ handoffId: "hd_pilot", version: 1, publishedAt: "2026-10-11T00:00:00.000Z", items: [
  { id: "i1", type: "CONFIRMED", priority: "CORE", statement: "Web first." },
] });
const submission: ReceiverSubmission = {
  protocol: "hermeneus.receiver-submission/v0", publicationRef: packet.publicationRef,
  packetDigest: packet.canonicalDigest, question: "What is first?", answerText: "Web first [HI-001].",
};
const analysis = {
  inventory: { protocol: "hermeneus.claim-inventory/v0.1", segments: [
    { segmentId: "S-001", start: 0, end: submission.answerText.length, sourceText: submission.answerText, disposition: "CLAIMS_EXTRACTED" },
  ], claims: [
    { claimId: "CL-001", segmentId: "S-001", start: 0, end: submission.answerText.length, sourceText: submission.answerText,
      normalizedClaim: "Web first", claimKind: "SENDER_STATE", claimedCitationIds: ["HI-001"] },
  ] },
  assessments: [{ claimId: "CL-001", verdict: "ENTAILED", reasonCode: "DIRECT_SUPPORT", supportedByIds: ["HI-001"], explanation: "Direct match." }],
  questionCoverage: "ADEQUATE", omittedCanonIds: [],
};

describe("external OpenAI verifier pilot boundary", () => {
  it("reserves once and sends only canonical items, question, and answer with storage disabled", async () => {
    const reserve = vi.fn(async () => undefined);
    const parse = vi.fn(async (_body: Parameters<OpenAI["responses"]["parse"]>[0]) => ({ output_parsed: analysis } as ParsedResponse<unknown>));
    const forgedPacket = { ...packet, rawToken: "SECRET_SHARE_BEARER", displayTitle: "PRIVATE_TITLE", provenance: "PRIVATE_SOURCE" };
    const verifier = createOpenAiExternalVerifier("test-key", { reserve, client: { responses: { parse } } });
    expect(await verifier.analyze({ packet: forgedPacket, submission })).toEqual(analysis);
    expect(reserve).toHaveBeenCalledTimes(1);
    const request = parse.mock.calls[0]![0];
    expect(request.model).toBe(PILOT_VERIFIER_MODEL);
    expect(request.store).toBe(false);
    expect(request.max_output_tokens).toBe(PILOT_MAX_OUTPUT_TOKENS);
    const serialized = JSON.stringify(request);
    expect(serialized).toContain("Web first");
    expect(serialized).toContain("What is first?");
    expect(serialized).not.toContain("SECRET_SHARE_BEARER");
    expect(serialized).not.toContain("PRIVATE_TITLE");
    expect(serialized).not.toContain("PRIVATE_SOURCE");
  });

  it("rejects oversized payload before reserving or calling the provider", async () => {
    const reserve = vi.fn(async () => undefined);
    const parse = vi.fn();
    const verifier = createOpenAiExternalVerifier("test-key", { reserve, client: { responses: { parse } } });
    await expect(verifier.analyze({ packet, submission: { ...submission, answerText: "x".repeat(PILOT_MAX_INPUT_BYTES) } }))
      .rejects.toThrow(/size limit/);
    expect(reserve).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });
});
