import { z } from "zod";

export const handoffItemTypeSchema = z.enum([
  "CORE_INTENT",
  "CONTEXT",
  "CONFIRMED",
  "TENTATIVE",
  "OPEN",
  "REJECTED",
  "CONSTRAINT",
  "RATIONALE",
]);

export const handoffPrioritySchema = z.enum(["CORE", "IMPORTANT", "SUPPORTING"]);

export const sourceReferenceSchema = z
  .object({
    messageId: z.string().min(1),
    excerpt: z.string().min(1).optional(),
  })
  .strict();

export const handoffItemSchema = z
  .object({
    id: z.string().min(1),
    type: handoffItemTypeSchema,
    statement: z.string().min(1),
    priority: handoffPrioritySchema,
    createdBy: z.enum(["EXTRACTION", "CREATOR"]),
    sources: z.array(sourceReferenceSchema),
  })
  .strict();

export const draftHandoffSchema = z
  .object({
    id: z.string().min(1),
    items: z.array(handoffItemSchema),
  })
  .strict();

export const publishedHandoffSchema = z
  .object({
    handoffId: z.string().min(1),
    version: z.number().int().positive(),
    publishedAt: z.string().min(1),
    items: z.array(handoffItemSchema),
  })
  .strict();

export type HandoffItemType = z.infer<typeof handoffItemTypeSchema>;
export type HandoffPriority = z.infer<typeof handoffPrioritySchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type HandoffItem = z.infer<typeof handoffItemSchema>;
export type DraftHandoff = z.infer<typeof draftHandoffSchema>;
export type PublishedHandoff = z.infer<typeof publishedHandoffSchema>;
