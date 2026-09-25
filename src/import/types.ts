export type MessageRole = "creator" | "assistant" | "other";

export type ImportInput = {
  text: string;
  importedAt: string;
  conversationId?: string;
};

export type NormalizedMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt?: string;
  source: {
    provider: string;
    originalId?: string;
  };
};

export type NormalizedConversation = {
  id: string;
  source: {
    provider: string;
    importedAt: string;
  };
  messages: NormalizedMessage[];
};

export interface ConversationAdapter {
  readonly id: string;
  canHandle(input: ImportInput): Promise<boolean>;
  parse(input: ImportInput): Promise<NormalizedConversation>;
}
