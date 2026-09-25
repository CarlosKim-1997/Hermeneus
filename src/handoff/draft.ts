import { draftHandoffSchema, handoffItemSchema, type DraftHandoff, type HandoffItem } from "./schema.js";

export function createDraft(id: string, items: HandoffItem[]): DraftHandoff {
  return draftHandoffSchema.parse({ id, items });
}

export function addItem(draft: DraftHandoff, item: HandoffItem): DraftHandoff {
  const created = handoffItemSchema.parse({ ...item, createdBy: "CREATOR" });
  return { ...draft, items: [...draft.items, created] };
}

export function removeItem(draft: DraftHandoff, itemId: string): DraftHandoff {
  return { ...draft, items: draft.items.filter((item) => item.id !== itemId) };
}

export function updateItem(
  draft: DraftHandoff,
  itemId: string,
  patch: Partial<Pick<HandoffItem, "type" | "statement" | "priority" | "sources">>,
): DraftHandoff {
  let found = false;
  const items = draft.items.map((item) => {
    if (item.id !== itemId) return item;
    found = true;
    return handoffItemSchema.parse({ ...item, ...patch, createdBy: "CREATOR" });
  });
  if (!found) throw new Error(`Handoff item ${itemId} is not in draft ${draft.id}`);
  return { ...draft, items };
}
