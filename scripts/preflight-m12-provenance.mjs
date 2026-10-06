#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const HANDOFF_ITEM_TYPES = new Set([
  "CORE_INTENT",
  "CONTEXT",
  "CONFIRMED",
  "TENTATIVE",
  "OPEN",
  "REJECTED",
  "CONSTRAINT",
  "RATIONALE",
]);
const HANDOFF_PRIORITIES = new Set(["CORE", "IMPORTANT", "SUPPORTING"]);
const HANDOFF_CREATED_BY = new Set(["EXTRACTION", "CREATOR"]);
const LEGACY_TOP_LEVEL_KEYS = new Set(["handoffId", "version", "publishedAt", "items"]);
const LEGACY_ITEM_KEYS = new Set(["id", "type", "statement", "priority", "createdBy", "sources"]);
const SOURCE_KEYS = new Set(["messageId", "excerpt"]);

function blocker(message) {
  const error = new Error(`PREFLIGHT BLOCKER: ${message}`);
  error.name = "PreflightBlocker";
  throw error;
}

export function fail(message) {
  console.error(`PREFLIGHT BLOCKER: ${message}`);
  process.exit(1);
}

function unexpectedKeys(object, allowed, context) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    blocker(`${context}: expected object`);
  }
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      blocker(`${context}: unexpected key "${key}"`);
    }
  }
}

export function validateLegacyPublishedSnapshot(snapshot, pub, contextLabel) {
  const ctx = contextLabel ?? `${pub.handoff_id} v${pub.version}`;
  unexpectedKeys(snapshot, LEGACY_TOP_LEVEL_KEYS, `published ${ctx}`);

  if (typeof snapshot.handoffId !== "string" || snapshot.handoffId.trim() === "") {
    blocker(`published ${ctx}: invalid handoffId`);
  }
  if (snapshot.handoffId !== pub.handoff_id) {
    blocker(`published ${ctx}: snapshot handoffId mismatch`);
  }
  if (typeof snapshot.version !== "number" || !Number.isInteger(snapshot.version) || snapshot.version <= 0) {
    blocker(`published ${ctx}: invalid version`);
  }
  if (snapshot.version !== pub.version) {
    blocker(`published ${ctx}: snapshot version mismatch`);
  }
  if (typeof snapshot.publishedAt !== "string" || snapshot.publishedAt.trim() === "") {
    blocker(`published ${ctx}: invalid publishedAt`);
  }
  const publishedAtDb = new Date(pub.published_at).toISOString();
  const publishedAtSnap = new Date(snapshot.publishedAt).toISOString();
  if (publishedAtDb !== publishedAtSnap) {
    blocker(`published ${ctx}: publishedAt mismatch (${publishedAtSnap} vs ${publishedAtDb})`);
  }
  if (!Array.isArray(snapshot.items)) {
    blocker(`published ${ctx}: items is not an array`);
  }

  for (const item of snapshot.items) {
    unexpectedKeys(item, LEGACY_ITEM_KEYS, `published ${ctx} item`);
    if (typeof item.id !== "string" || item.id.trim() === "") {
      blocker(`published ${ctx}: invalid item id`);
    }
    if (typeof item.statement !== "string" || item.statement.trim() === "") {
      blocker(`published ${ctx} item ${item.id}: invalid statement`);
    }
    if (!HANDOFF_ITEM_TYPES.has(item.type)) {
      blocker(`published ${ctx} item ${item.id}: invalid type "${item.type}"`);
    }
    if (!HANDOFF_PRIORITIES.has(item.priority)) {
      blocker(`published ${ctx} item ${item.id}: invalid priority "${item.priority}"`);
    }
    if (!HANDOFF_CREATED_BY.has(item.createdBy)) {
      blocker(`published ${ctx} item ${item.id}: invalid createdBy "${item.createdBy}"`);
    }
    if (!Array.isArray(item.sources)) {
      blocker(`published ${ctx} item ${item.id}: missing sources array`);
    }
    for (const source of item.sources) {
      unexpectedKeys(source, SOURCE_KEYS, `published ${ctx} item ${item.id} source`);
      if (typeof source.messageId !== "string" || source.messageId.trim() === "") {
        blocker(`published ${ctx} item ${item.id}: empty messageId`);
      }
      if (source.excerpt !== undefined) {
        if (typeof source.excerpt !== "string" || source.excerpt.trim() === "") {
          blocker(`published ${ctx} item ${item.id}: blank excerpt`);
        }
      }
    }
  }
}

export async function runPreflightOnClient(client) {
  const stats = {
    publishedVersions: 0,
    publishedItems: 0,
    sourceReferences: 0,
    handoffs: 0,
    sourceConversations: 0,
    orphanSourceConversations: 0,
    sharedSourceConversationGroups: 0,
  };

  const handoffs = await client.query(`SELECT id, source_conversation_id FROM handoffs ORDER BY id`);
  stats.handoffs = handoffs.rowCount ?? 0;

  for (const handoff of handoffs.rows) {
    if (!handoff.source_conversation_id) {
      blocker(`handoff ${handoff.id} has null source_conversation_id before migration`);
    }
    const conv = await client.query(`SELECT 1 FROM source_conversations WHERE id = $1`, [handoff.source_conversation_id]);
    if (conv.rowCount === 0) {
      blocker(`handoff ${handoff.id} references missing conversation ${handoff.source_conversation_id}`);
    }
  }

  const shared = await client.query(
    `SELECT source_conversation_id, COUNT(DISTINCT owner_creator_id) AS owners, COUNT(*) AS handoffs
     FROM handoffs
     WHERE source_conversation_id IS NOT NULL
     GROUP BY source_conversation_id
     HAVING COUNT(*) > 1 OR COUNT(DISTINCT owner_creator_id) > 1`,
  );
  stats.sharedSourceConversationGroups = shared.rowCount ?? 0;
  if (shared.rowCount) {
    console.warn("Preflight notice: shared source_conversation_id across handoffs detected:");
    for (const row of shared.rows) {
      console.warn(`  conversation ${row.source_conversation_id}: ${row.handoffs} handoffs, ${row.owners} owners`);
    }
  }

  const pubs = await client.query(
    `SELECT handoff_id, version, snapshot_json, published_at FROM published_handoff_versions ORDER BY handoff_id, version`,
  );
  stats.publishedVersions = pubs.rowCount ?? 0;

  for (const pub of pubs.rows) {
    const snapshot = pub.snapshot_json;
    validateLegacyPublishedSnapshot(snapshot, pub);

    const handoff = handoffs.rows.find((row) => row.id === pub.handoff_id);
    if (!handoff) {
      blocker(`published ${pub.handoff_id} v${pub.version} has no handoff row`);
    }
    const conversationId = handoff.source_conversation_id;

    for (const item of snapshot.items) {
      stats.publishedItems += 1;
      for (const source of item.sources) {
        stats.sourceReferences += 1;
        const message = await client.query(
          `SELECT id, conversation_id, content FROM source_messages WHERE id = $1`,
          [source.messageId],
        );
        if (message.rowCount === 0) {
          blocker(`missing message ${source.messageId} for ${pub.handoff_id} v${pub.version} item ${item.id}`);
        }
        if (message.rows[0].conversation_id !== conversationId) {
          blocker(`message ${source.messageId} wrong conversation for handoff ${pub.handoff_id}`);
        }
        if (source.excerpt !== undefined && !message.rows[0].content.includes(source.excerpt)) {
          blocker(`excerpt not in message ${source.messageId} for ${pub.handoff_id} v${pub.version}`);
        }
      }
    }
  }

  const convCount = await client.query(`SELECT COUNT(*)::int AS count FROM source_conversations`);
  stats.sourceConversations = convCount.rows[0].count;

  const orphans = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM source_conversations sc
     WHERE NOT EXISTS (SELECT 1 FROM handoffs h WHERE h.source_conversation_id = sc.id)`,
  );
  stats.orphanSourceConversations = orphans.rows[0].count;

  return stats;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL or TEST_DATABASE_URL is required");
    process.exit(2);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const stats = await runPreflightOnClient(client);
    console.log("M12 provenance migration preflight PASS");
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    if (error instanceof Error && error.name === "PreflightBlocker") {
      fail(error.message.replace(/^PREFLIGHT BLOCKER: /, ""));
    }
    throw error;
  } finally {
    await client.end();
  }
}

function isExecutedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
