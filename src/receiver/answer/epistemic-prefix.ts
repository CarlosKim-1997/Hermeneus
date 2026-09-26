import type { InterpretationAuthorityItem } from "../interpretation-authority.js";

export function buildEpistemicPrefix(question: string, selectedItems: readonly InterpretationAuthorityItem[]): string {
  const parts: string[] = [];
  const rejected = selectedItems.filter((item) => item.type === "REJECTED");
  if (rejected.length > 0 && /^(are|is|do|does|will|should|can)\b/i.test(question.trim())) {
    parts.push("No.");
  }
  if (selectedItems.some((item) => item.type === "TENTATIVE")) {
    parts.push("This is still tentative.");
  }
  return parts.length ? `${parts.join(" ")} ` : "";
}
