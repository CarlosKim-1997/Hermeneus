import type { InterpretationAuthorityItem } from "../interpretation-authority.js";
import type { ReceiverInterpretationProposal } from "./proposal-schema.js";

export interface ReceiverSemanticInterpreter {
  interpret(input: {
    question: string;
    items: readonly InterpretationAuthorityItem[];
  }): Promise<ReceiverInterpretationProposal>;
}
