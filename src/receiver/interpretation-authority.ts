import type { HandoffItemType, HandoffPriority } from "../handoff/schema.js";
import type { PublishedHandoff } from "../handoff/schema.js";
import type { PublishedReceiverView } from "../persistence/receiver-types.js";

export type InterpretationAuthorityItem = {
  id: string;
  type: HandoffItemType;
  statement: string;
  priority: HandoffPriority;
};

export type InterpretationAuthority = {
  handoffId: string;
  version: number;
  items: readonly InterpretationAuthorityItem[];
};

export function authorityFromPublished(published: PublishedHandoff): InterpretationAuthority {
  return {
    handoffId: published.handoffId,
    version: published.version,
    items: published.items.map(({ id, type, statement, priority }) => ({
      id,
      type,
      statement,
      priority,
    })),
  };
}

export function authorityFromReceiverView(view: PublishedReceiverView): InterpretationAuthority {
  return {
    handoffId: view.handoffId,
    version: view.version,
    items: view.items,
  };
}
