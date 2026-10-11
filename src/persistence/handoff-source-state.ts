export type HandoffSourceState =
  | { kind: "retained"; conversationId: string }
  | { kind: "erased"; erasedAt: string }
  | { kind: "not_collected" };
