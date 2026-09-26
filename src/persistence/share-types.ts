import type { HandoffItemType, HandoffPriority } from "../handoff/schema.js";
import type { ProvenanceReference, ReceiverItem } from "./receiver-types.js";

export type SharedReceiverView = {
  version: number;
  publishedAt: string;
  items: ReceiverItem[];
};

export type SharedProvenanceBundle = {
  items: Array<{
    itemId: string;
    references: ProvenanceReference[];
  }>;
};

export function toSharedReceiverView(input: {
  version: number;
  publishedAt: string;
  items: ReceiverItem[];
}): SharedReceiverView {
  return {
    version: input.version,
    publishedAt: input.publishedAt,
    items: input.items.map((item) => ({
      id: item.id,
      type: item.type as HandoffItemType,
      statement: item.statement,
      priority: item.priority as HandoffPriority,
    })),
  };
}

export function toSharedProvenanceBundle(bundle: {
  items: Array<{ itemId: string; references: ProvenanceReference[] }>;
}): SharedProvenanceBundle {
  return {
    items: bundle.items.map((entry) => ({
      itemId: entry.itemId,
      references: entry.references.map((reference) => ({ ...reference })),
    })),
  };
}
