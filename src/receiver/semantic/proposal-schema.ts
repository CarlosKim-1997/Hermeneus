import { z } from "zod";

export const semanticClassifications = ["SUPPORTED", "OPEN", "UNKNOWN"] as const;
export type SemanticClassification = (typeof semanticClassifications)[number];

export type ReceiverInterpretationProposal = {
  classification: SemanticClassification;
  citationIds: string[];
};

export const receiverInterpretationProposalSchema = z.object({
  classification: z.enum(semanticClassifications),
  citationIds: z.array(z.string()),
});
