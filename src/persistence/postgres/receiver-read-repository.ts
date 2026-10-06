import type { Pool, PoolClient } from "pg";
import { publishedHandoffSchema } from "../../handoff/schema.js";
import { ProvenanceIntegrityError } from "../errors.js";
import type { ReceiverReadRepository } from "../ports.js";
import {
  toReceiverItems,
  type ProvenanceBundle,
  type ProvenanceReference,
  type PublishedReceiverView,
} from "../receiver-types.js";

async function readProvenanceLocked(
  client: PoolClient,
  handoffId: string,
  version: number,
  itemIds: string[],
): Promise<ProvenanceBundle> {
  const handoff = await client.query<{ source_conversation_id: string | null; source_erased_at: Date | null }>(
    `SELECT source_conversation_id, source_erased_at FROM handoffs WHERE id = $1 FOR SHARE`,
    [handoffId],
  );
  if (handoff.rowCount === 0) {
    throw new ProvenanceIntegrityError(`Handoff ${handoffId} does not exist for provenance read`);
  }
  const row = handoff.rows[0]!;
  if (row.source_erased_at !== null || row.source_conversation_id === null) {
    return { availability: "unavailable_erased", handoffId, version, items: [] };
  }

  const uniqueItemIds = [...new Set(itemIds.filter(Boolean))];
  if (uniqueItemIds.length === 0) {
    return { availability: "retained", handoffId, version, items: [] };
  }

  const publishedExists = await client.query(
    `SELECT 1 FROM published_handoff_versions WHERE handoff_id = $1 AND version = $2`,
    [handoffId, version],
  );
  if (publishedExists.rowCount === 0) {
    throw new ProvenanceIntegrityError(`Published handoff ${handoffId} v${version} does not exist`);
  }

  const snapshotResult = await client.query<{ snapshot_json: unknown }>(
    `SELECT snapshot_json FROM published_handoff_versions WHERE handoff_id = $1 AND version = $2`,
    [handoffId, version],
  );
  const published = publishedHandoffSchema.parse(snapshotResult.rows[0]!.snapshot_json);
  const canonicalItemIds = new Set(published.items.map((item) => item.id));
  const selectedItemIds = uniqueItemIds.filter((id) => canonicalItemIds.has(id));
  if (selectedItemIds.length === 0) {
    return { availability: "retained", handoffId, version, items: [] };
  }

  const provenanceRows = await client.query<{
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
  for (const provRow of provenanceRows.rows) {
    const bucket = rowsByItem.get(provRow.item_id) ?? [];
    bucket.push(provRow);
    rowsByItem.set(provRow.item_id, bucket);
  }

  const messageIds = [...new Set(provenanceRows.rows.map((provRow) => provRow.message_id))];
  const roles =
    messageIds.length === 0
      ? { rows: [] as Array<{ id: string; role: "creator" | "assistant" | "other" }> }
      : await client.query<{ id: string; role: "creator" | "assistant" | "other" }>(
          `SELECT id, role FROM source_messages WHERE id = ANY($1::text[])`,
          [messageIds],
        );
  const roleById = new Map(roles.rows.map((roleRow) => [roleRow.id, roleRow.role]));

  const items = selectedItemIds.map((itemId) => {
    const itemRows = rowsByItem.get(itemId) ?? [];
    const references: ProvenanceReference[] = itemRows.map((provRow) => {
      const role = roleById.get(provRow.message_id);
      if (!role) {
        throw new ProvenanceIntegrityError(
          `Published provenance for ${handoffId} v${version} item ${itemId} references missing message ${provRow.message_id}`,
        );
      }
      if (provRow.excerpt) {
        return {
          messageId: provRow.message_id,
          role,
          excerpt: provRow.excerpt,
          excerptAvailable: true,
        };
      }
      return {
        messageId: provRow.message_id,
        role,
        excerptAvailable: false,
      };
    });
    return { itemId, references };
  });

  return { availability: "retained", handoffId, version, items };
}

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
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const bundle = await readProvenanceLocked(client, handoffId, version, itemIds);
      await client.query("COMMIT");
      return bundle;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
