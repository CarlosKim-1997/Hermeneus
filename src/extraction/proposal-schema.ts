import { z } from "zod";
import { handoffItemTypeSchema, handoffPrioritySchema } from "../handoff/schema.js";

/** Source reference from model or fixture; excerpt required for AI-generated candidates after validation. */
export const extractionSourceReferenceSchema = z
  .object({
    messageId: z.string().min(1),
    excerpt: z.string().min(1),
  })
  .strict();

export const extractionCandidateSchema = z
  .object({
    type: handoffItemTypeSchema,
    statement: z.string().min(1),
    priority: handoffPrioritySchema,
    sources: z.array(extractionSourceReferenceSchema).min(1),
  })
  .strict();

export const extractionProposalSchema = z
  .object({
    candidates: z.array(extractionCandidateSchema),
  })
  .strict();

export type ExtractionSourceReference = z.infer<typeof extractionSourceReferenceSchema>;
export type ExtractionCandidate = z.infer<typeof extractionCandidateSchema>;
export type ExtractionProposal = z.infer<typeof extractionProposalSchema>;

/** Parsed structured model output shape (no item IDs or authority fields). */
export const modelExtractionOutputSchema = extractionProposalSchema;
