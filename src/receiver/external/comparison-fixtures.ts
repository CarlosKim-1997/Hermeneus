import { buildReceiverPacket } from "../../portable/receiver-packet.js";
import type { ReceiverVerdict } from "./verifier.js";

// Synthetic only; frozen before provider evaluation. Never load live Handoffs.
export const comparisonPacket = buildReceiverPacket({
  handoffId: "hd_synthetic_comparison_t026", version: 1, publishedAt: "2026-10-15T00:00:00.000Z",
  items: [
    { id: "time", type: "CONFIRMED", priority: "CORE", statement: "The reading group starts Saturday at 2 pm." },
    { id: "place", type: "OPEN", priority: "IMPORTANT", statement: "The reading group location is undecided." },
    { id: "fee", type: "REJECTED", priority: "CORE", statement: "Charge participants an attendance fee." },
  ],
});

type Fixture = { id: string; answer: string; expected: ReceiverVerdict["verdict"]; critical: boolean };
export const comparisonFixtures: readonly Fixture[] = [
  { id: "direct-support", answer: "The reading group starts Saturday at 2 pm [HI-001].", expected: "ALIGNED", critical: false },
  { id: "paraphrase", answer: "The approved start time is 14:00 on Saturday [HI-001].", expected: "ALIGNED", critical: false },
  { id: "unicode-support", answer: "📚 독서 모임은 토요일 오후 2시에 시작합니다 [HI-001].", expected: "ALIGNED", critical: false },
  { id: "time-contradiction", answer: "The reading group starts Saturday at 3 pm [HI-001].", expected: "CONTRADICTED", critical: true },
  { id: "open-status-flip", answer: "The reading group location has been decided [HI-002].", expected: "CONTRADICTED", critical: true },
  { id: "invented-rationale", answer: "The Sender chose 2 pm because all participants work mornings [HI-001].", expected: "UNSUPPORTED", critical: true },
  { id: "invented-intent", answer: "The Sender intends to sell books at the group [HI-001].", expected: "UNSUPPORTED", critical: true },
  { id: "revive-rejection", answer: "Participants must pay the approved attendance fee [HI-003].", expected: "CONTRADICTED", critical: true },
  { id: "irrelevant-citation", answer: "The reading group starts Saturday at 2 pm [HI-002].", expected: "PARTIAL", critical: true },
  { id: "hidden-unsupported-claim", answer: "Summary:\n- The reading group starts Saturday at 2 pm [HI-001].\n- The Sender will provide free lunch for everyone.", expected: "UNSUPPORTED", critical: true },
];
