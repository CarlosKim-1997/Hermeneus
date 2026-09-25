import type { HandoffItemType, HandoffPriority } from "../handoff/schema.js";

export type ReceiverItem = {
  id: string;
  type: HandoffItemType;
  statement: string;
  priority: HandoffPriority;
};

export type PublishedReceiverView = {
  handoffId: string;
  version: number;
  publishedAt: string;
  items: ReceiverItem[];
};

export type ProvenanceReference = {
  messageId: string;
  role: "creator" | "assistant" | "other";
  excerpt?: string;
  excerptAvailable: boolean;
};

export type ProvenanceBundle = {
  handoffId: string;
  version: number;
  items: Array<{
    itemId: string;
    references: ProvenanceReference[];
  }>;
};

export function toReceiverItems<T extends ReceiverItem>(items: T[]): ReceiverItem[] {
  return items.map(({ id, type, statement, priority }) => ({ id, type, statement, priority }));
}
