import { createHash } from "node:crypto";
import { z } from "zod";
import { handoffItemTypeSchema, handoffPrioritySchema } from "../handoff/schema.js";
import type { PublishedReceiverView } from "../persistence/receiver-types.js";
import { jcs } from "./jcs.js";

const packetCoreSchema = z.object({
  protocol: z.literal("hermeneus.receiver-packet/v0"),
  publicationRef: z.string().regex(/^pub_[a-f0-9]{32}$/),
  version: z.number().int().positive(),
  publishedAt: z.string().datetime({ offset: true }),
  items: z.array(z.object({
    citeId: z.string().regex(/^HI-[0-9]{3,}$/),
    type: handoffItemTypeSchema,
    priority: handoffPrioritySchema,
    statement: z.string().min(1).max(4000).refine((value) => /\S/u.test(value)),
  }).strict()).min(1).max(200),
}).strict();
export const receiverPacketSchema = packetCoreSchema.extend({
  canonicalDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
export const receiverSubmissionSchema = z.object({
  protocol: z.literal("hermeneus.receiver-submission/v0"),
  publicationRef: z.string().regex(/^pub_[a-f0-9]{32}$/),
  packetDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  question: z.string().max(4000).optional(),
  answerText: z.string().min(1).max(20000).refine((value) => /\S/u.test(value)),
}).strict();
export type ReceiverPacket = z.infer<typeof receiverPacketSchema>;
export type ReceiverSubmission = z.infer<typeof receiverSubmissionSchema>;

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(jcs(value), "utf8").digest("hex")}`;
}

export function buildReceiverPacket(view: PublishedReceiverView): ReceiverPacket {
  const publicationRef = `pub_${createHash("sha256")
    .update(`hermeneus-publication-ref/v0:${view.handoffId}:${view.version}`, "utf8")
    .digest("hex").slice(0, 32)}`;
  const core = packetCoreSchema.parse({
    protocol: "hermeneus.receiver-packet/v0",
    publicationRef,
    version: view.version,
    publishedAt: view.publishedAt,
    items: view.items.map((item, index) => ({
      citeId: `HI-${String(index + 1).padStart(3, "0")}`,
      type: item.type,
      priority: item.priority,
      statement: item.statement,
    })),
  });
  return receiverPacketSchema.parse({ ...core, canonicalDigest: digest(core) });
}

export function matchesAuthorizedPacket(submission: ReceiverSubmission, packet: ReceiverPacket): boolean {
  return submission.publicationRef === packet.publicationRef && submission.packetDigest === packet.canonicalDigest;
}
