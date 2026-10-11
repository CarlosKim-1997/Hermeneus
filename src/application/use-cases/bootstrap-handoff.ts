import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { CreatorId } from "../../creator/types.js";
import { handoffItemTypeSchema, handoffPrioritySchema } from "../../handoff/schema.js";
import { proposalToDraft, portableProposalSchema } from "../../portable/proposal.js";
import { generateOpaqueId } from "../ids.js";
import type { getRepositories } from "../runtime.js";

const bootstrapInputSchema = z.object({
  protocol: z.literal("hermeneus.portable-proposal/v0"),
  items: z.array(z.object({
    type: handoffItemTypeSchema,
    priority: handoffPrioritySchema,
    statement: z.string().min(1).max(4000),
  }).strict()).min(1).max(50),
  notesAcknowledged: z.literal(true),
  requestKey: z.string().uuid(),
  saveTitle: z.boolean(),
  title: z.string().optional(),
}).strict();

export async function bootstrapHandoff(
  repos: ReturnType<typeof getRepositories>,
  ownerCreatorId: CreatorId,
  unknownInput: unknown,
) {
  const input = bootstrapInputSchema.parse(unknownInput);
  const title = input.saveTitle ? input.title?.trim() : undefined;
  if (input.saveTitle && !title) throw new Error("A title is required when saving it");
  const proposal = portableProposalSchema.parse({
    protocol: input.protocol,
    ...(title ? { title } : {}),
    items: input.items.map((item, index) => ({ ...item, proposalId: `P-${String(index + 1).padStart(3, "0")}` })),
  });
  const handoffId = generateOpaqueId("hd");
  return repos.bootstrapHandoff.createAtomic({
    ownerCreatorId,
    handoffId,
    requestKey: input.requestKey,
    draft: proposalToDraft(proposal, handoffId, () => `item_${randomBytes(12).toString("hex")}`),
    ...(title ? { displayTitle: title } : {}),
  });
}
