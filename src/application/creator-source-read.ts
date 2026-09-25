import type { ConversationRepository } from "../persistence/ports.js";
import type { NormalizedConversation } from "../import/types.js";

/** Creator-only read path. Receiver boundaries must not use this. */
export class CreatorSourceRead {
  constructor(private readonly conversations: ConversationRepository) {}

  async getSourceConversation(conversationId: string): Promise<NormalizedConversation | undefined> {
    return this.conversations.get(conversationId);
  }
}
