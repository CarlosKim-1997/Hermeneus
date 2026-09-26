import type { InterpretationAuthorityItem } from "../interpretation-authority.js";
import { UNKNOWN_ANSWER, type Interpretation } from "../interpret.js";
import type { SemanticClassification } from "./proposal-schema.js";

export function renderInterpretationAnswer(
  classification: SemanticClassification,
  citationIds: string[],
  items: readonly InterpretationAuthorityItem[],
  question: string,
): Interpretation {
  const byId = new Map(items.map((item) => [item.id, item]));
  const cited = citationIds
    .map((id) => byId.get(id))
    .filter((item): item is InterpretationAuthorityItem => Boolean(item));

  if (classification === "UNKNOWN") {
    return { classification: "UNKNOWN", answer: UNKNOWN_ANSWER, citations: [] };
  }

  if (classification === "OPEN") {
    const openItem = cited.find((item) => item.type === "OPEN") ?? cited[0];
    if (!openItem) {
      return { classification: "UNKNOWN", answer: UNKNOWN_ANSWER, citations: [] };
    }
    return {
      classification: "OPEN",
      answer: `The creator has not decided this. ${openItem.statement}`,
      citations: [openItem.id],
    };
  }

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
