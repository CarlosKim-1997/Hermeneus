import type { ConversationAdapter, ImportInput, MessageRole, NormalizedConversation } from "./types.js";

const ROLE_LINE = /^(creator|assistant|other):\s*(.*)$/i;

export const genericTextAdapter: ConversationAdapter = {
  id: "generic-text",
  async canHandle(input) {
    return splitMessages(input.text).length > 0;
  },
  async parse(input) {
    const messages = splitMessages(input.text);
    if (messages.length === 0) {
      throw new Error("GenericTextAdapter found no role-prefixed messages");
    }
    const id = input.conversationId ?? `conv_${hashText(input.text)}`;
    return {
      id,
      source: { provider: "generic-text", importedAt: input.importedAt },
      messages: messages.map((message, index) => ({
        id: `${id}:m${index + 1}`,
        role: message.role,
        content: message.content,
        source: { provider: "generic-text" },
      })),
    } satisfies NormalizedConversation;
  },
};

function splitMessages(text: string): Array<{ role: MessageRole; content: string }> {
  const messages: Array<{ role: MessageRole; content: string }> = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = ROLE_LINE.exec(line);
    if (match) {
      const role = match[1].toLowerCase() as MessageRole;
      messages.push({ role, content: match[2].trim() });
      continue;
    }
    const current = messages.at(-1);
    if (!current) continue;
    current.content = `${current.content}\n${line}`.trim();
  }
  return messages.filter((message) => message.content.length > 0);
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
