import type { HandoffItemType } from "../handoff/schema.js";
import type { InterpretationAuthority, InterpretationAuthorityItem } from "./interpretation-authority.js";

export const ANSWERABILITIES = ["SUPPORTED", "DERIVED", "OPEN", "UNKNOWN"] as const;
export type Answerability = (typeof ANSWERABILITIES)[number];

export type Interpretation = {
  classification: Answerability;
  answer: string;
  citations: string[];
};

export const UNKNOWN_ANSWER =
  "UNKNOWN. The approved handoff does not contain enough information to answer.";

const STOP_WORDS = new Set([
  "are", "we", "the", "a", "an", "to", "of", "is", "in", "on", "for", "and", "or",
  "this", "that", "what", "will", "be", "it", "right", "then", "so", "do", "does",
  "using", "use", "our", "you", "did", "was", "were", "not", "dont", "need", "with",
  "from", "into", "about", "have", "has", "can", "should", "would", "could", "just",
  "than", "its", "your", "they", "them", "their",
]);

const DIRECT_TYPES = new Set<HandoffItemType>([
  "CORE_INTENT",
  "CONTEXT",
  "CONFIRMED",
  "REJECTED",
  "CONSTRAINT",
  "RATIONALE",
]);

/** Conservative deterministic DERIVED rules only (e.g. disabled web search). */
export function interpretDeterministicDerived(
  question: string,
  authority: InterpretationAuthority,
): Interpretation | null {
  return deriveDisabledCapability(question, authority.items);
}

export function interpretPublished(question: string, authority: InterpretationAuthority): Interpretation {
  const items = authority.items;
  const derived = deriveDisabledCapability(question, items);
  const ranked = rankItems(question, items);
  if (ranked.length === 0) return derived ?? unknown();

  const bestScore = ranked[0]?.score ?? 0;
  const best = ranked.filter((entry) => entry.score === bestScore).map((entry) => entry.item);
  if (best.some((item) => item.type === "OPEN") && best.every((item) => item.type === "OPEN" || item.type === "TENTATIVE")) {
    const openItem = best.find((item) => item.type === "OPEN");
    if (!openItem) return unknown();
    return {
      classification: "OPEN",
      answer: `The creator has not decided this. ${openItem.statement}`,
      citations: [openItem.id],
    };
  }

  const direct = ranked
    .map((entry) => entry.item)
    .filter((item) => DIRECT_TYPES.has(item.type) || item.type === "TENTATIVE");
  if (direct.length === 0) return derived ?? unknown();

  const related = relatedApproved(direct, items);
  const cited = dedupe([...direct, ...related]);
  const rejected = cited.filter((item) => item.type === "REJECTED");
  const sentences: string[] = [];
  if (rejected.length > 0 && /^(are|is|do|does|will|should|can)\b/i.test(question.trim())) {
    sentences.push("No.");
  }
  for (const item of cited) {
    if (item.type === "TENTATIVE") sentences.push(`This is still tentative. ${item.statement}`);
    else sentences.push(item.statement);
  }
  return {
    classification: "SUPPORTED",
    answer: sentences.join(" "),
    citations: cited.map((item) => item.id),
  };
}

function unknown(): Interpretation {
  return { classification: "UNKNOWN", answer: UNKNOWN_ANSWER, citations: [] };
}

function deriveDisabledCapability(
  question: string,
  items: readonly InterpretationAuthorityItem[],
): Interpretation | null {
  const q = question.toLowerCase();
  if (/\b(engineer|developer|staff|hire|hiring)\b/.test(q)) return null;
  if (!/\b(browse|browsing|search)\b/.test(q)) return null;
  const item = items.find((candidate) => /web search/i.test(candidate.statement) && /disabled/i.test(candidate.statement));
  if (!item) return null;
  return {
    classification: "DERIVED",
    answer: `No. ${item.statement}`,
    citations: [item.id],
  };
}

function rankItems(
  question: string,
  items: readonly InterpretationAuthorityItem[],
): Array<{ item: InterpretationAuthorityItem; score: number }> {
  const questionTokens = tokens(question);
  return items
    .map((item) => ({ item, score: overlap(questionTokens, tokens(item.statement)) }))
    .filter((entry) => entry.score >= 2)
    .sort((a, b) => b.score - a.score);
}

function relatedApproved(
  matched: InterpretationAuthorityItem[],
  items: readonly InterpretationAuthorityItem[],
): InterpretationAuthorityItem[] {
  const matchedTokens = new Set(matched.flatMap((item) => [...tokens(item.statement)]));
  return items.filter((item) => {
    if (matched.some((existing) => existing.id === item.id)) return false;
    if (item.type !== "CONFIRMED" && item.type !== "CORE_INTENT" && item.type !== "CONSTRAINT") return false;
    return [...tokens(item.statement)].some((token) => matchedTokens.has(token));
  });
}

function tokens(text: string): Set<string> {
  const found = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  return new Set(found);
}

function overlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

function dedupe(items: InterpretationAuthorityItem[]): InterpretationAuthorityItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
