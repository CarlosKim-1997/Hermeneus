import type { NormalizedConversation } from "../import/types.js";

export function conversationsEqual(left: NormalizedConversation, right: NormalizedConversation): boolean {
  return canonicalConversation(left) === canonicalConversation(right);
}

function canonicalConversation(conversation: NormalizedConversation): string {
  return JSON.stringify({
    id: conversation.id,
    source: {
      provider: conversation.source.provider,
      importedAt: conversation.source.importedAt,
    },
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt ?? null,
      source: {
        provider: message.source.provider,
        originalId: message.source.originalId ?? null,
      },
    })),
  });
}
