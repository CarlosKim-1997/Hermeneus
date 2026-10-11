import { describe, expect, it } from "vitest";
import { buildReceiverPacket, type ReceiverSubmission } from "../src/portable/receiver-packet.js";
import { aggregateVerdict, inspectInventory, unavailableVerdict, type VerifierAnalysis } from "../src/receiver/external/verifier.js";

const packet = buildReceiverPacket({ handoffId: "hd_test", version: 1, publishedAt: "2026-10-10T00:00:00.000Z", items: [
  { id: "a", type: "CONFIRMED", priority: "CORE", statement: "Proposal input is approved." },
  { id: "b", type: "OPEN", priority: "IMPORTANT", statement: "Hosting is undecided." },
] });
const answer = "Input is approved [HI-001]. Hosting is decided [HI-002].";
const submission: ReceiverSubmission = { protocol: "hermeneus.receiver-submission/v0", publicationRef: packet.publicationRef, packetDigest: packet.canonicalDigest, answerText: answer };
const firstEnd = answer.indexOf(" Hosting");
const analysis: VerifierAnalysis = { inventory: { protocol: "hermeneus.claim-inventory/v0.1", segments: [
  { segmentId: "S-001", start: 0, end: firstEnd, sourceText: answer.slice(0, firstEnd), disposition: "CLAIMS_EXTRACTED" },
  { segmentId: "S-002", start: firstEnd, end: answer.length, sourceText: answer.slice(firstEnd), disposition: "CLAIMS_EXTRACTED" },
], claims: [
  { claimId: "CL-001", segmentId: "S-001", start: 0, end: firstEnd, sourceText: answer.slice(0, firstEnd), normalizedClaim: "Input approved", claimKind: "SENDER_STATE", claimedCitationIds: ["HI-001"] },
  { claimId: "CL-002", segmentId: "S-002", start: firstEnd, end: answer.length, sourceText: answer.slice(firstEnd), normalizedClaim: "Hosting decided", claimKind: "SENDER_STATE", claimedCitationIds: ["HI-002"] },
] }, assessments: [
  { claimId: "CL-001", verdict: "ENTAILED", reasonCode: "DIRECT_SUPPORT", supportedByIds: ["HI-001"], explanation: "Approved item supports it." },
  { claimId: "CL-002", verdict: "CONTRADICTED", reasonCode: "STATUS_FLIP", supportedByIds: ["HI-002"], explanation: "OPEN item was presented as decided." },
], questionCoverage: "NOT_ASSESSED", omittedCanonIds: [] };

describe("external verifier safety boundaries", () => {
  it("prioritizes a detected contradiction over a supported claim", () => {
    expect(aggregateVerdict(packet, submission, analysis).verdict).toBe("CONTRADICTED");
  });
  it("never aligns an unsupported or material ambiguous claim", () => {
    for (const [claimVerdict, expected] of [["UNSUPPORTED", "UNSUPPORTED"], ["AMBIGUOUS", "INDETERMINATE"]] as const) {
      const changed = { ...analysis, assessments: analysis.assessments.map((entry) => entry.claimId === "CL-002" ? { ...entry, verdict: claimVerdict, reasonCode: "INSUFFICIENT_EVIDENCE" as const } : entry) };
      expect(aggregateVerdict(packet, submission, changed).verdict).toBe(expected);
    }
  });
  it("fails closed for a gap, wrong UTF-16 span, or missing assessment", () => {
    const gap = { ...analysis, inventory: { ...analysis.inventory, segments: analysis.inventory.segments.slice(0, 1), claims: analysis.inventory.claims.slice(0, 1) }, assessments: analysis.assessments.slice(0, 1) };
    expect(inspectInventory(answer, gap.inventory).complete).toBe(false);
    expect(aggregateVerdict(packet, submission, gap).verdict).toBe("INDETERMINATE");
    const noAssessment = { ...analysis, assessments: analysis.assessments.slice(0, 1) };
    expect(aggregateVerdict(packet, submission, noAssessment).verdict).toBe("INDETERMINATE");
  });
  it("returns a nonpassing v0.1 result without a provider", () => {
    const result = unavailableVerdict(packet);
    expect(result.protocol).toBe("hermeneus.receiver-verdict/v0.1");
    expect(result.verdict).toBe("INDETERMINATE");
  });
  it("marks a supported but uncited Sender claim PARTIAL", () => {
    const shortSubmission = { ...submission, answerText: answer.slice(0, firstEnd) };
    const oneClaim = { ...analysis, inventory: { ...analysis.inventory,
      segments: [analysis.inventory.segments[0]!],
      claims: [{ ...analysis.inventory.claims[0]!, claimedCitationIds: [] }],
    }, assessments: [analysis.assessments[0]!] };
    expect(aggregateVerdict(packet, shortSubmission, oneClaim).verdict).toBe("PARTIAL");
  });
});
