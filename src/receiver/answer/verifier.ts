import type { InterpretationAuthorityItem } from "../interpretation-authority.js";
import type { GeneratedAnswerProposal, GroundingVerification } from "./proposal-schema.js";

export interface ReceiverGroundingVerifier {
  verify(input: {
    question: string;
    selectedItems: readonly InterpretationAuthorityItem[];
    proposal: GeneratedAnswerProposal;
  }): Promise<GroundingVerification>;
}
