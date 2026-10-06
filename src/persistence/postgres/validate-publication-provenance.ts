import type { DraftHandoff } from "../../handoff/schema.js";
import { ProvenanceValidationError } from "../errors.js";
import type { Queryable } from "./pool.js";

export async function validatePublicationProvenance(
  db: Queryable,
  handoffId: string,
  draft: DraftHandoff,
): Promise<void> {
  const handoff = await db.query<{ source_conversation_id: string | null; source_erased_at: Date | null }>(
    "SELECT source_conversation_id, source_erased_at FROM handoffs WHERE id = $1",
    [handoffId],
  );
  if (handoff.rowCount === 0) {
    throw new ProvenanceValidationError(`Handoff ${handoffId} does not exist`);
  }
  const row = handoff.rows[0]!;
  if (row.source_erased_at !== null || row.source_conversation_id === null) {
    throw new ProvenanceValidationError(
      `Handoff ${handoffId} source is unavailable; cannot publish source-backed provenance`,
    );
  }
  const conversationId = row.source_conversation_id;
  const messageIds = [...new Set(draft.items.flatMap((item) => item.sources.map((source) => source.messageId)))];

  if (messageIds.length === 0) return;

  const messages = await db.query<{ id: string; conversation_id: string; content: string }>(
    `SELECT id, conversation_id, content
     FROM source_messages
     WHERE id = ANY($1::text[])`,
    [messageIds],
  );
  const byId = new Map(messages.rows.map((messageRow) => [messageRow.id, messageRow]));

  for (const item of draft.items) {
    for (const source of item.sources) {
      const message = byId.get(source.messageId);
      if (!message) {
        throw new ProvenanceValidationError(
          `Handoff item ${item.id} references missing message ${source.messageId}`,
        );
      }
      if (message.conversation_id !== conversationId) {
        throw new ProvenanceValidationError(
          `Handoff item ${item.id} references message ${source.messageId} from another conversation`,
        );
      }
      if (source.excerpt !== undefined && !message.content.includes(source.excerpt)) {
        throw new ProvenanceValidationError(
          `Handoff item ${item.id} excerpt is not supported by message ${source.messageId}`,
        );
      }
    }
  }
}
