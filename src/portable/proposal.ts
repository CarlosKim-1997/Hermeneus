import { z } from "zod";
import { handoffItemTypeSchema, handoffPrioritySchema, draftHandoffSchema, type DraftHandoff } from "../handoff/schema.js";

const MAX_RAW_BYTES = 128 * 1024;
const boundedText = (max: number) =>
  z.string().refine((value) => value.trim().length > 0 && Array.from(value).length <= max);

const proposalItemSchema = z.object({
  proposalId: z.string().regex(/^P-[0-9]{3,}$/),
  type: handoffItemTypeSchema,
  priority: handoffPrioritySchema,
  statement: boundedText(4000),
}).strict();

export const portableProposalSchema = z.object({
  protocol: z.literal("hermeneus.portable-proposal/v0"),
  title: boundedText(160).optional(),
  items: z.array(proposalItemSchema).min(1).max(50),
  reviewNotes: z.array(boundedText(1000)).max(20).optional(),
}).strict();

export type PortableProposal = z.infer<typeof portableProposalSchema>;
export type PortableProposalErrorCode = "LIMIT_EXCEEDED" | "JSON_INVALID" | "DUPLICATE_KEY" |
  "FORBIDDEN_FIELD" | "SCHEMA_INVALID" | "PROTOCOL_UNSUPPORTED" | "DUPLICATE_PROPOSAL_ID";

export class PortableProposalError extends Error {
  constructor(public readonly code: PortableProposalErrorCode, public readonly path?: string) {
    super(code);
    this.name = "PortableProposalError";
  }
}

// JSON.parse silently keeps the last repeated object key. The input has already
// passed JSON.parse, so this scan needs only to track object keys and strings.
function assertNoDuplicateObjectKeys(raw: string): void {
  const stack: Array<{ kind: "object"; keys: Set<string>; expectsKey: boolean } | { kind: "array" }> = [];
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '"') {
      const start = index;
      while (++index < raw.length) {
        if (raw[index] === "\\") { index += 1; continue; }
        if (raw[index] === '"') break;
      }
      const top = stack[stack.length - 1];
      if (top?.kind === "object" && top.expectsKey) {
        const key = JSON.parse(raw.slice(start, index + 1)) as string;
        if (top.keys.has(key)) throw new PortableProposalError("DUPLICATE_KEY");
        top.keys.add(key);
        top.expectsKey = false;
      }
    } else if (char === "{") {
      stack.push({ kind: "object", keys: new Set(), expectsKey: true });
    } else if (char === "[") {
      stack.push({ kind: "array" });
    } else if (char === "}" || char === "]") {
      stack.pop();
    } else if (char === ",") {
      const top = stack[stack.length - 1];
      if (top?.kind === "object") top.expectsKey = true;
    }
  }
}

export function parsePortableProposal(raw: string): PortableProposal {
  if (Buffer.byteLength(raw, "utf8") > MAX_RAW_BYTES) throw new PortableProposalError("LIMIT_EXCEEDED");
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; }
  catch { throw new PortableProposalError("JSON_INVALID"); }
  assertNoDuplicateObjectKeys(raw);
  const parsed = portableProposalSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code: PortableProposalErrorCode = issue?.code === "unrecognized_keys" ? "FORBIDDEN_FIELD" :
      issue?.path[0] === "protocol" ? "PROTOCOL_UNSUPPORTED" : "SCHEMA_INVALID";
    throw new PortableProposalError(code, issue?.path.join("."));
  }
  const ids = new Set<string>();
  for (const item of parsed.data.items) {
    if (ids.has(item.proposalId)) throw new PortableProposalError("DUPLICATE_PROPOSAL_ID", "items");
    ids.add(item.proposalId);
  }
  return parsed.data;
}

export function proposalToDraft(proposal: PortableProposal, handoffId: string, nextItemId: () => string): DraftHandoff {
  const allocatedIds = new Set<string>();
  const items = proposal.items.map(({ type, priority, statement }) => {
    const id = nextItemId();
    if (allocatedIds.has(id)) throw new PortableProposalError("SCHEMA_INVALID", "items.id");
    allocatedIds.add(id);
    return { id, type, priority, statement, createdBy: "EXTRACTION" as const, sources: [] };
  });
  return draftHandoffSchema.parse({ id: handoffId, items });
}
