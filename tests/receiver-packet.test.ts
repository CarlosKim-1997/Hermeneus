import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { jcs } from "../src/portable/jcs.js";
import { buildReceiverPacket, matchesAuthorizedPacket, receiverPacketSchema, receiverSubmissionSchema } from "../src/portable/receiver-packet.js";

const view = {
  handoffId: "hd_private_123",
  version: 2,
  publishedAt: "2026-10-10T00:00:00.000Z",
  items: [{ id: "internal_1", type: "CONFIRMED" as const, priority: "CORE" as const, statement: "한글 😀 approved" }],
};

describe("RFC 8785 and Receiver Packet", () => {
  it("matches the RFC 8785 primitive and sorted-object sample", () => {
    const sample = { string: "€$\u000f\nA'B\"\\\\\"/", numbers: [333333333.3333333, 1e30, 4.5, 0.002, 1e-27], literals: [null, true, false] };
    expect(jcs(sample)).toBe('{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}');
    expect(jcs({ "\uE000": 1, "😀": 2 })).toBe('{"😀":2,"":1}');
  });

  it("rejects invalid Unicode and non-JSON values", () => {
    expect(() => jcs({ x: "\ud800" })).toThrow();
    expect(() => jcs({ x: Infinity })).toThrow();
    expect(() => jcs({ x: undefined })).toThrow();
  });

  it("projects only approved public fields with deterministic aliases and digest", () => {
    const packet = buildReceiverPacket(view);
    expect(receiverPacketSchema.parse(packet)).toEqual(packet);
    expect(JSON.stringify(packet)).not.toContain("hd_private_123");
    expect(JSON.stringify(packet)).not.toContain("internal_1");
    expect(packet.items[0]?.citeId).toBe("HI-001");
    const { canonicalDigest, ...core } = packet;
    expect(canonicalDigest).toBe(`sha256:${createHash("sha256").update(jcs(core)).digest("hex")}`);
    expect(buildReceiverPacket({ ...view, items: [{ ...view.items[0]!, statement: "changed" }] }).canonicalDigest).not.toBe(canonicalDigest);
  });

  it("rejects submitted identity/version mismatch and unknown protocol", () => {
    const packet = buildReceiverPacket(view);
    const submission = receiverSubmissionSchema.parse({ protocol: "hermeneus.receiver-submission/v0", publicationRef: packet.publicationRef, packetDigest: packet.canonicalDigest, answerText: "Answer" });
    expect(matchesAuthorizedPacket(submission, packet)).toBe(true);
    expect(matchesAuthorizedPacket({ ...submission, packetDigest: `sha256:${"0".repeat(64)}` }, packet)).toBe(false);
    expect(() => receiverSubmissionSchema.parse({ ...submission, protocol: "hermeneus.receiver-verdict/v0" })).toThrow();
  });
});
