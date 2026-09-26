import type { InterpretationAuthorityItem } from "../interpretation-authority.js";
import type { GeneratedAnswerProposal } from "./proposal-schema.js";

export interface ReceiverAnswerGenerator {
  generate(input: {
    question: string;
    items: readonly InterpretationAuthorityItem[];
  }): Promise<GeneratedAnswerProposal>;
}
