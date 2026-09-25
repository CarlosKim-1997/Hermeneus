import type { Pool } from "pg";
import { publishedHandoffSchema, type PublishedHandoff } from "../../handoff/schema.js";
import type { ReceiverReadRepository } from "../ports.js";
import { toReceiverItems, type ProvenanceBundle, type PublishedReceiverView, type ProvenanceReference } from "../receiver-types.js";

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

    const roles =
      messageIds.length === 0
        ? { rows: [] as Array<{ id: string; role: "creator" | "assistant" | "other" }> }
        : await this.pool.query<{ id: string; role: "creator" | "assistant" | "other" }>(
            `SELECT id, role
             FROM source_messages
             WHERE id = ANY($1::text[])`,
            [messageIds],
          );
    const roleById = new Map(roles.rows.map((row) => [row.id, row.role]));

    return {
      handoffId,
      version,
      items: selected.map((item) => ({
        itemId: item.id,
        references: item.sources
          .map((source): ProvenanceReference | undefined => {
            const role = roleById.get(source.messageId);
            if (!role) return undefined;
            if (source.excerpt) {
              return {
                messageId: source.messageId,
                role,
                excerpt: source.excerpt,
                excerptAvailable: true,
              };
            }
            return {
              messageId: source.messageId,
              role,
              excerptAvailable: false,
            };
          })
          .filter((entry): entry is ProvenanceReference => Boolean(entry)),
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
