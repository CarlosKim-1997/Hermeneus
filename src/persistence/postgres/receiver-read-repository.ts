import type { Pool } from "pg";
import { publishedHandoffSchema } from "../../handoff/schema.js";
import { ProvenanceIntegrityError } from "../errors.js";
import type { ReceiverReadRepository } from "../ports.js";
import {
  toReceiverItems,
  type ProvenanceBundle,
  type ProvenanceReference,
  type PublishedReceiverView,
} from "../receiver-types.js";
import { PostgresHandoffRootRepository } from "./handoff-root-repository.js";

export class PostgresReceiverReadRepository implements ReceiverReadRepository {
  private readonly handoffs: PostgresHandoffRootRepository;

  constructor(private readonly pool: Pool) {
    this.handoffs = new PostgresHandoffRootRepository(pool);
  }

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
    const sourceState = await this.handoffs.getHandoffSourceState(handoffId);
    if (!sourceState) {
      throw new ProvenanceIntegrityError(`Handoff ${handoffId} does not exist for provenance read`);
    }
    if (sourceState.kind === "erased") {
      return {
        availability: "unavailable_erased",
        handoffId,
        version,
        items: [],
      };
    }

    const uniqueItemIds = [...new Set(itemIds.filter(Boolean))];
    if (uniqueItemIds.length === 0) {
      return { availability: "retained", handoffId, version, items: [] };
    }

    await this.ensurePublishedExists(handoffId, version);

    const snapshotResult = await this.pool.query<{ snapshot_json: unknown }>(
      `SELECT snapshot_json
       FROM published_handoff_versions
       WHERE handoff_id = $1 AND version = $2`,
      [handoffId, version],
    );
    const published = publishedHandoffSchema.parse(snapshotResult.rows[0]!.snapshot_json);
    const canonicalItemIds = new Set(published.items.map((item) => item.id));
    const selectedItemIds = uniqueItemIds.filter((id) => canonicalItemIds.has(id));
    if (selectedItemIds.length === 0) {
      return { availability: "retained", handoffId, version, items: [] };
    }

    const provenanceRows = await this.pool.query<{
      item_id: string;
      source_index: number;
      message_id: string;
      excerpt: string | null;
    }>(
      `SELECT item_id, source_index, message_id, excerpt
       FROM published_handoff_provenance
       WHERE handoff_id = $1 AND version = $2 AND item_id = ANY($3::text[])
       ORDER BY item_id ASC, source_index ASC`,
      [handoffId, version, selectedItemIds],
    );

    const rowsByItem = new Map<string, typeof provenanceRows.rows>();
    for (const row of provenanceRows.rows) {
      const bucket = rowsByItem.get(row.item_id) ?? [];
      bucket.push(row);
      rowsByItem.set(row.item_id, bucket);
    }

    const messageIds = [...new Set(provenanceRows.rows.map((row) => row.message_id))];
    const roles =
      messageIds.length === 0
        ? { rows: [] as Array<{ id: string; role: "creator" | "assistant" | "other" }> }
        : await this.pool.query<{ id: string; role: "creator" | "assistant" | "other" }>(
            `SELECT id, role FROM source_messages WHERE id = ANY($1::text[])`,
            [messageIds],
          );
    const roleById = new Map(roles.rows.map((row) => [row.id, row.role]));

    const items = selectedItemIds.map((itemId) => {
      const itemRows = rowsByItem.get(itemId) ?? [];
      const references: ProvenanceReference[] = itemRows.map((row) => {
        const role = roleById.get(row.message_id);
        if (!role) {
          throw new ProvenanceIntegrityError(
            `Published provenance for ${handoffId} v${version} item ${itemId} references missing message ${row.message_id}`,
          );
        }
        if (row.excerpt) {
          return {
            messageId: row.message_id,
            role,
            excerpt: row.excerpt,
            excerptAvailable: true,
          };
        }
        return {
          messageId: row.message_id,
          role,
          excerptAvailable: false,
        };
      });
      return { itemId, references };
    });

    return { availability: "retained", handoffId, version, items };
  }

  private async ensurePublishedExists(handoffId: string, version: number): Promise<void> {
    const result = await this.pool.query(`SELECT 1 FROM published_handoff_versions WHERE handoff_id = $1 AND version = $2`, [
      handoffId,
      version,
    ]);
    if (result.rowCount === 0) {
      throw new ProvenanceIntegrityError(`Published handoff ${handoffId} v${version} does not exist`);
    }
  }
}
