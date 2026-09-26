import type { HandoffItemType } from "../../handoff/schema.js";
import type { InterpretationAuthorityItem } from "../interpretation-authority.js";
import type { ReceiverInterpretationProposal } from "./proposal-schema.js";

export type ProposalValidationResult =
  | { ok: true; proposal: ReceiverInterpretationProposal }
  | { ok: false; reason: string };

export function validateInterpretationProposal(
  proposal: ReceiverInterpretationProposal,
  items: readonly InterpretationAuthorityItem[],
): ProposalValidationResult {
  const byId = new Map(items.map((item) => [item.id, item]));

  if (proposal.classification === "UNKNOWN") {
    if (proposal.citationIds.length > 0) {
      return { ok: false, reason: "UNKNOWN must not cite Handoff items." };
    }
    return { ok: true, proposal };
  }

  if (proposal.citationIds.length === 0) {
    return { ok: false, reason: `${proposal.classification} requires at least one citation.` };
  }

  const cited: InterpretationAuthorityItem[] = [];
  for (const id of proposal.citationIds) {
    const item = byId.get(id);
    if (!item) {
      return { ok: false, reason: `Unknown citation id: ${id}` };
    }
    cited.push(item);
  }

  if (proposal.classification === "OPEN") {
    if (!cited.some((item) => item.type === "OPEN")) {
      return { ok: false, reason: "OPEN classification requires at least one OPEN item citation." };
    }
    return { ok: true, proposal };
  }

  if (proposal.classification === "SUPPORTED") {
    if (cited.every((item) => item.type === "OPEN")) {
      return { ok: false, reason: "SUPPORTED cannot cite only OPEN items." };
    }
    if (cited.some((item) => item.type === "OPEN") && cited.every((item) => isOpenOrTentative(item.type))) {
      return { ok: false, reason: "OPEN matters must use OPEN classification, not SUPPORTED." };
    }
    return { ok: true, proposal };
  }

  return { ok: false, reason: "Unsupported classification." };
}

function isOpenOrTentative(type: HandoffItemType): boolean {
  return type === "OPEN" || type === "TENTATIVE";
}
