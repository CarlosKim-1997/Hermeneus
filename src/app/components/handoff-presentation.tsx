import type { HandoffItemType, HandoffPriority } from "../../handoff/schema.js";
import type { ReceiverVerdict } from "../../receiver/external/verifier.js";

export const ITEM_LABELS: Record<HandoffItemType, string> = {
  CORE_INTENT: "핵심 의도", CONTEXT: "배경 맥락", CONFIRMED: "확정 사항", TENTATIVE: "검토 중",
  OPEN: "미정 사항", REJECTED: "제외한 방향", CONSTRAINT: "지켜야 할 조건", RATIONALE: "판단 근거",
};
export const PRIORITY_LABELS: Record<HandoffPriority, string> = { CORE: "핵심", IMPORTANT: "중요", SUPPORTING: "보충" };

export function ItemMeaning({ type, priority }: { type: HandoffItemType; priority: HandoffPriority }) {
  return <div className="meaning-line"><span className={`meaning-badge meaning-${type.toLowerCase()}`}>{ITEM_LABELS[type]}</span><span className="priority-label">{PRIORITY_LABELS[priority]}</span></div>;
}

export function HandoffSteps({ current }: { current: 1 | 2 | 3 }) {
  return <ol className="handoff-steps" aria-label="전달 준비 단계">{["내 AI에서 초안 준비", "전달 내용 검토", "전달본 확정·공유"].map((label, index) => <li key={label} aria-current={index + 1 === current ? "step" : undefined}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{label}</li>)}</ol>;
}

// These describe only a verdict for the submitted text and pinned Canon.
export const VERDICT_LABELS: Record<ReceiverVerdict["verdict"], string> = {
  ALIGNED: "전달본과 정합", PARTIAL: "일부 보완이 필요함", UNSUPPORTED: "전달본에 근거 없는 주장", CONTRADICTED: "전달본과 모순", INDETERMINATE: "판정할 수 없음", INVALID: "검사할 수 없는 형식",
};
