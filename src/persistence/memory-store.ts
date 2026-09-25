import type { PublishedHandoff } from "../handoff/schema.js";
import type { NormalizedConversation } from "../import/types.js";

export type ReceiverView = {
  handoffId: string;
  version: number;
  items: PublishedHandoff["items"];
};

/** In-memory stand-in for the persistence boundary. Receiver reads do not return raw transcripts. */
export class MemoryStore {
  private readonly conversations = new Map<string, NormalizedConversation>();
  private readonly published = new Map<string, PublishedHandoff>();

  saveConversation(conversation: NormalizedConversation): void {
    this.conversations.set(conversation.id, structuredClone(conversation));
  }

  savePublished(version: PublishedHandoff): void {
    this.published.set(key(version.handoffId, version.version), structuredClone(version));
  }

  getPublished(handoffId: string, version: number): PublishedHandoff | undefined {
    const found = this.published.get(key(handoffId, version));
    return found ? structuredClone(found) : undefined;
  }

  receiverView(handoffId: string, version: number): ReceiverView | undefined {
    const found = this.getPublished(handoffId, version);
    if (!found) return undefined;
    return { handoffId: found.handoffId, version: found.version, items: found.items };
  }
}

function key(handoffId: string, version: number): string {
  return `${handoffId}@${version}`;
}
