import { z } from "zod";
import type { ReceiverPacket, ReceiverSubmission } from "../../portable/receiver-packet.js";

const segmentSchema = z.object({ segmentId: z.string().regex(/^S-\d{3,}$/), start: z.number().int().min(0), end: z.number().int().positive(), sourceText: z.string().min(1), disposition: z.enum(["CLAIMS_EXTRACTED", "NON_MATERIAL", "EXTERNAL_ONLY", "UNRESOLVED"]) }).strict();
const claimSchema = z.object({ claimId: z.string().regex(/^CL-\d{3,}$/), segmentId: segmentSchema.shape.segmentId, start: z.number().int().min(0), end: z.number().int().positive(), sourceText: z.string().min(1), normalizedClaim: z.string().min(1), claimKind: z.enum(["SENDER_STATE", "EXPLICIT_OPEN", "CANON_ABSENCE", "DERIVATION", "ANALOGY", "EXTERNAL", "NON_MATERIAL"]), claimedCitationIds: z.array(z.string().regex(/^HI-\d{3,}$/)).max(200) }).strict();
export const claimInventorySchema = z.object({ protocol: z.literal("hermeneus.claim-inventory/v0.1"), segments: z.array(segmentSchema).min(1).max(400), claims: z.array(claimSchema).max(200) }).strict();
export type ClaimInventory = z.infer<typeof claimInventorySchema>;
const claimVerdict = z.enum(["ENTAILED", "DERIVED", "OPEN", "UNKNOWN", "ANALOGY", "UNVERIFIED_EXTERNAL", "UNSUPPORTED", "CONTRADICTED", "AMBIGUOUS"]);
const reasonCode = z.enum(["DIRECT_SUPPORT", "NARROW_DERIVATION", "EXPLICIT_OPEN", "NO_CANON_EVIDENCE", "ILLUSTRATIVE_ONLY", "EXTERNAL_CONTENT", "CITATION_UNKNOWN_ID", "CITATION_STATUS_MISMATCH", "CITATION_MISSING", "ANNOTATION_PARSE_ERROR", "STATUS_FLIP", "UNSUPPORTED_REASON", "INSUFFICIENT_EVIDENCE"]);
const assessmentSchema = z.object({ claimId: claimSchema.shape.claimId, verdict: claimVerdict, reasonCode, supportedByIds: z.array(z.string().regex(/^HI-\d{3,}$/)).max(200), explanation: z.string().min(1).max(1000) }).strict();
export const analysisSchema = z.object({ inventory: claimInventorySchema, assessments: z.array(assessmentSchema).max(200), questionCoverage: z.enum(["ADEQUATE", "OMISSIONS", "NOT_ASSESSED", "INDETERMINATE"]), omittedCanonIds: z.array(z.string().regex(/^HI-\d{3,}$/)).max(200) }).strict();
export type VerifierAnalysis = z.infer<typeof analysisSchema>;
export interface ExternalVerifierPort { analyze(input: { packet: ReceiverPacket; submission: ReceiverSubmission }): Promise<VerifierAnalysis> }
export type ReceiverVerdict = {
  protocol: "hermeneus.receiver-verdict/v0.1"; publicationRef: string; packetDigest: string;
  verdict: "ALIGNED" | "PARTIAL" | "UNSUPPORTED" | "CONTRADICTED" | "INDETERMINATE" | "INVALID";
  technicalStatus: "COMPLETE" | "PARTIAL_FAILURE" | "PROVIDER_FAILURE" | "AUTH_UNAVAILABLE";
  coverage: { answerClaimCoverage: "COMPLETE_REVIEWED" | "INCOMPLETE" | "INDETERMINATE"; questionCoverage: VerifierAnalysis["questionCoverage"]; reviewedSegments: number; unresolvedSegments: string[]; omittedCanonIds: string[] };
  claims: Array<{ claimId: string; sourceSpan: { start: number; end: number; text: string }; normalizedClaim: string; claimedIds: string[]; supportedByIds: string[]; verdict: z.infer<typeof claimVerdict>; reasonCode: z.infer<typeof reasonCode>; explanation: string }>;
  issues: string[]; limitations: string[];
};
const limitation = "Checks this answer only against the pinned Published Canon; no source fidelity or human understanding claim.";
const base = (packet: ReceiverPacket) => ({ protocol: "hermeneus.receiver-verdict/v0.1" as const, publicationRef: packet.publicationRef, packetDigest: packet.canonicalDigest });
export function unavailableVerdict(packet: ReceiverPacket): ReceiverVerdict {
  return { ...base(packet), verdict: "INDETERMINATE", technicalStatus: "PROVIDER_FAILURE", coverage: { answerClaimCoverage: "INDETERMINATE", questionCoverage: "NOT_ASSESSED", reviewedSegments: 0, unresolvedSegments: [], omittedCanonIds: [] }, claims: [], issues: ["Semantic verification was unavailable."], limitations: [limitation] };
}

export function inspectInventory(answer: string, inventory: ClaimInventory) {
  const issues: string[] = [];
  const covered = new Uint8Array(answer.length);
  const segmentIds = new Set<string>();
  const claimIds = new Set<string>();
  for (const segment of inventory.segments) {
    if (segmentIds.has(segment.segmentId)) issues.push("Duplicate segment ID");
    segmentIds.add(segment.segmentId);
    if (segment.start >= segment.end || segment.end > answer.length || answer.slice(segment.start, segment.end) !== segment.sourceText) { issues.push(`Invalid segment span ${segment.segmentId}`); continue; }
    let overlaps = false;
    for (let i = segment.start; i < segment.end; i++) { if (covered[i]) overlaps = true; covered[i] = 1; }
    if (overlaps) issues.push(`Overlapping segment ${segment.segmentId}`);
  }
  for (let i = 0; i < answer.length; i++) {
    if (/\S/u.test(answer[i]!) && !covered[i]) { issues.push("Uncovered answer text"); break; }
  }
  for (const claim of inventory.claims) {
    if (claimIds.has(claim.claimId)) issues.push("Duplicate claim ID");
    claimIds.add(claim.claimId);
    const segment = inventory.segments.find((entry) => entry.segmentId === claim.segmentId);
    if (!segment || claim.start < segment.start || claim.end > segment.end || claim.start >= claim.end || answer.slice(claim.start, claim.end) !== claim.sourceText) issues.push(`Invalid claim span ${claim.claimId}`);
    if (new Set(claim.claimedCitationIds).size !== claim.claimedCitationIds.length) issues.push(`Duplicate citations ${claim.claimId}`);
  }
  for (const segment of inventory.segments) {
    const hasClaims = inventory.claims.some((claim) => claim.segmentId === segment.segmentId);
    if ((segment.disposition === "CLAIMS_EXTRACTED") !== hasClaims) issues.push(`Claim disposition mismatch ${segment.segmentId}`);
  }
  const unresolved = inventory.segments.filter((segment) => segment.disposition === "UNRESOLVED").map((segment) => segment.segmentId);
  return { complete: issues.length === 0 && unresolved.length === 0, issues, unresolved };
}

export function aggregateVerdict(packet: ReceiverPacket, submission: ReceiverSubmission, raw: unknown): ReceiverVerdict {
  const analysis = analysisSchema.parse(raw);
  const inspected = inspectInventory(submission.answerText, analysis.inventory);
  const allowed = new Set(packet.items.map((item) => item.citeId));
  const issues = [...inspected.issues];
  let citationDefect = false;
  const assessments = new Map(analysis.assessments.map((assessment) => [assessment.claimId, assessment]));
  if (assessments.size !== analysis.assessments.length) issues.push("Duplicate assessment ID");
  if (analysis.assessments.some((entry) => !analysis.inventory.claims.some((claim) => claim.claimId === entry.claimId))) issues.push("Assessment without source claim");
  if (analysis.omittedCanonIds.some((id) => !allowed.has(id))) issues.push("Unknown omitted item ID");
  const claims = analysis.inventory.claims.map((claim) => {
    const assessed = assessments.get(claim.claimId);
    if (!assessed) issues.push(`Missing assessment ${claim.claimId}`);
    if (claim.claimedCitationIds.some((id) => !allowed.has(id))) { issues.push(`Unknown citation ${claim.claimId}`); citationDefect = true; }
    if (assessed?.supportedByIds.some((id) => !allowed.has(id))) issues.push(`Unknown supporting item ${claim.claimId}`);
    if (assessed && ["ENTAILED", "DERIVED", "OPEN"].includes(assessed.verdict) && assessed.supportedByIds.length === 0) issues.push(`Missing evidence ${claim.claimId}`);
    if (assessed && ["ENTAILED", "DERIVED", "OPEN"].includes(assessed.verdict) &&
        assessed.supportedByIds.some((id) => !claim.claimedCitationIds.includes(id))) citationDefect = true;
    if (assessed?.verdict === "OPEN" && assessed.supportedByIds.some((id) => packet.items.find((item) => item.citeId === id)?.type !== "OPEN")) issues.push(`OPEN status mismatch ${claim.claimId}`);
    return { claimId: claim.claimId, sourceSpan: { start: claim.start, end: claim.end, text: claim.sourceText }, normalizedClaim: claim.normalizedClaim, claimedIds: claim.claimedCitationIds, supportedByIds: assessed?.supportedByIds ?? [], verdict: assessed?.verdict ?? "AMBIGUOUS" as const, reasonCode: assessed?.reasonCode ?? "INSUFFICIENT_EVIDENCE" as const, explanation: assessed?.explanation ?? "Claim not assessed." };
  });
  const hasMaterialClaim = analysis.inventory.claims.some((claim) => !["NON_MATERIAL", "ANALOGY"].includes(claim.claimKind));
  const incomplete = !inspected.complete || issues.some((issue) => !issue.startsWith("Unknown citation ")) || !hasMaterialClaim || analysis.questionCoverage === "INDETERMINATE";
  let verdict: ReceiverVerdict["verdict"] = "ALIGNED";
  if (claims.some((claim) => claim.verdict === "CONTRADICTED")) verdict = "CONTRADICTED";
  else if (incomplete || claims.some((claim) => claim.verdict === "AMBIGUOUS")) verdict = "INDETERMINATE";
  else if (claims.some((claim) => claim.verdict === "UNSUPPORTED")) verdict = "UNSUPPORTED";
  else if (citationDefect || claims.some((claim) => claim.verdict === "UNVERIFIED_EXTERNAL" || ["CITATION_MISSING", "CITATION_UNKNOWN_ID", "CITATION_STATUS_MISMATCH", "ANNOTATION_PARSE_ERROR"].includes(claim.reasonCode)) || analysis.questionCoverage === "OMISSIONS") verdict = "PARTIAL";
  return { ...base(packet), verdict, technicalStatus: incomplete ? "PARTIAL_FAILURE" : "COMPLETE", coverage: { answerClaimCoverage: incomplete ? "INCOMPLETE" : "COMPLETE_REVIEWED", questionCoverage: analysis.questionCoverage, reviewedSegments: analysis.inventory.segments.length - inspected.unresolved.length, unresolvedSegments: inspected.unresolved, omittedCanonIds: analysis.omittedCanonIds }, claims, issues, limitations: [limitation] };
}
