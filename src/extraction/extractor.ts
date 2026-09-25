import type { NormalizedConversation } from "../import/types.js";
import type { ExtractionProposal } from "./proposal-schema.js";

export interface HandoffExtractor {
  extract(conversation: NormalizedConversation): Promise<ExtractionProposal>;
}
