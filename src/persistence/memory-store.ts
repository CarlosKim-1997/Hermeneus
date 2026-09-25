import type { PublishedHandoff } from "../handoff/schema.js";
import type { NormalizedConversation } from "../import/types.js";
import { toReceiverItems, type PublishedReceiverView } from "./receiver-types.js";

/** In-memory stand-in for the persistence boundary. Receiver reads omit source excerpts. */
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

  receiverView(handoffId: string, version: number): PublishedReceiverView | undefined {
    const found = this.getPublished(handoffId, version);
    if (!found) return undefined;
    return {
      handoffId: found.handoffId,
      version: found.version,
      publishedAt: found.publishedAt,
      items: toReceiverItems(found.items),
    };
  }
}

function key(handoffId: string, version: number): string {
  return `${handoffId}@${version}`;
}
