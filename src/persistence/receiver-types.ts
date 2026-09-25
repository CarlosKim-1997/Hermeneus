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

export type ProvenanceMessage = {
  messageId: string;
  role: "creator" | "assistant" | "other";
  content: string;
  excerpt?: string;
};

export type ProvenanceBundle = {
  handoffId: string;
  version: number;
  items: Array<{
    itemId: string;
    messages: ProvenanceMessage[];
  }>;
};

export function toReceiverItems<T extends { id: string; type: HandoffItemType; statement: string; priority: HandoffPriority }>(
  items: T[],
): ReceiverItem[] {
  return items.map(({ id, type, statement, priority }) => ({ id, type, statement, priority }));
}
