import type { Pool } from "pg";
import { publishedHandoffSchema, type HandoffItem, type PublishedHandoff } from "../../handoff/schema.js";
import type { ReceiverReadRepository } from "../ports.js";
import { toReceiverItems, type ProvenanceBundle, type PublishedReceiverView } from "../receiver-types.js";

export class PostgresReceiverReadRepository implements ReceiverReadRepository {
  constructor(private readonly pool: Pool) {}

  async getPublishedView(handoffId: string, version: number): Promise<PublishedReceiverView | undefined> {
    const result = await this.pool.query<{ snapshot_json: unknown }>(
      `SELECT snapshot_json
       FROM published_handoff_versions
       WHERE handoff_id = $1 AND version = $2`,
      [handoffId, version],
    );
    if (result.rowCount === 0) return undefined;
    const published = publishedHandoffSchema.parse(result.rows[0].snapshot_json);
    return {
      handoffId: published.handoffId,
      version: published.version,
      publishedAt: published.publishedAt,
      items: toReceiverItems(published.items),
    };
  }

  async getProvenance(handoffId: string, version: number, itemIds: string[]): Promise<ProvenanceBundle> {
    const published = await this.loadPublished(handoffId, version);
    const selected = published.items.filter((item) => itemIds.includes(item.id));
    const messageIds = [...new Set(selected.flatMap((item) => item.sources.map((source) => source.messageId)))];

    const conversation = await this.pool.query<{ source_conversation_id: string }>(
      "SELECT source_conversation_id FROM handoffs WHERE id = $1",
      [handoffId],
    );
    if (conversation.rowCount === 0) {
      throw new Error(`Handoff ${handoffId} does not exist`);
    }
    const conversationId = conversation.rows[0].source_conversation_id;

    const messages =
      messageIds.length === 0
        ? { rows: [] as Array<{ id: string; role: "creator" | "assistant" | "other"; content: string }> }
        : await this.pool.query<{ id: string; role: "creator" | "assistant" | "other"; content: string }>(
            `SELECT id, role, content
             FROM source_messages
             WHERE conversation_id = $1 AND id = ANY($2::text[])`,
            [conversationId, messageIds],
          );

    const byId = new Map(messages.rows.map((row) => [row.id, row]));

    return {
      handoffId,
      version,
      items: selected.map((item) => ({
        itemId: item.id,
        messages: item.sources
          .map((source) => {
            const message = byId.get(source.messageId);
            if (!message) return undefined;
            return {
              messageId: source.messageId,
              role: message.role,
              content: message.content,
              excerpt: source.excerpt,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
      })),
    };
  }

  private async loadPublished(handoffId: string, version: number): Promise<PublishedHandoff> {
    const result = await this.pool.query<{ snapshot_json: unknown }>(
      `SELECT snapshot_json
       FROM published_handoff_versions
       WHERE handoff_id = $1 AND version = $2`,
      [handoffId, version],
    );
    if (result.rowCount === 0) {
      throw new Error(`Published handoff ${handoffId} v${version} does not exist`);
    }
    return publishedHandoffSchema.parse(result.rows[0].snapshot_json);
  }
}

export function publishedForInterpretation(view: PublishedReceiverView): PublishedHandoff {
  const items: HandoffItem[] = view.items.map((item) => ({
    ...item,
    createdBy: "CREATOR",
    sources: [],
  }));
  return publishedHandoffSchema.parse({
    handoffId: view.handoffId,
    version: view.version,
    publishedAt: view.publishedAt,
    items,
  });
}
