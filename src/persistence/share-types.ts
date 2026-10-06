import type { HandoffItemType, HandoffPriority } from "../handoff/schema.js";
import { isRetainedProvenance, type ProvenanceBundle, type ReceiverItem } from "./receiver-types.js";

export type SharedProvenanceReference = {
  role: "creator" | "assistant" | "other";
  excerpt?: string;
  excerptAvailable: boolean;
};

export type SharedReceiverView = {
  version: number;
  publishedAt: string;
  items: ReceiverItem[];
};

export type SharedProvenanceBundle = {
  items: Array<{
    itemId: string;
    references: SharedProvenanceReference[];
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

export function toSharedProvenanceBundle(bundle: ProvenanceBundle): SharedProvenanceBundle {
  if (!isRetainedProvenance(bundle)) {
    return { items: [] };
  }
  return {
    items: bundle.items.map((entry) => ({
      itemId: entry.itemId,
      references: entry.references.map((reference) => ({
        role: reference.role,
        excerptAvailable: reference.excerptAvailable,
        ...(reference.excerpt !== undefined ? { excerpt: reference.excerpt } : {}),
      })),
    })),
  };
}
