#!/usr/bin/env node
import pg from "pg";

const { Client } = pg;

function fail(message) {
  console.error(`PREFLIGHT BLOCKER: ${message}`);
  process.exit(1);
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
    const stats = {
      publishedVersions: 0,
      publishedItems: 0,
      sourceReferences: 0,
      handoffs: 0,
      sourceConversations: 0,
      orphanSourceConversations: 0,
      sharedSourceConversationGroups: 0,
    };

    const handoffs = await client.query(
      `SELECT id, source_conversation_id FROM handoffs ORDER BY id`,
    );
    stats.handoffs = handoffs.rowCount ?? 0;

    for (const handoff of handoffs.rows) {
      if (!handoff.source_conversation_id) {
        fail(`handoff ${handoff.id} has null source_conversation_id before migration`);
      }
      const conv = await client.query(`SELECT 1 FROM source_conversations WHERE id = $1`, [
        handoff.source_conversation_id,
      ]);
      if (conv.rowCount === 0) {
        fail(`handoff ${handoff.id} references missing conversation ${handoff.source_conversation_id}`);
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
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        fail(`published ${pub.handoff_id} v${pub.version} snapshot is not an object`);
      }
      if (snapshot.handoffId !== pub.handoff_id) {
        fail(`published ${pub.handoff_id} v${pub.version} snapshot handoffId mismatch`);
      }
      if (snapshot.version !== pub.version) {
        fail(`published ${pub.handoff_id} v${pub.version} snapshot version mismatch`);
      }
      if (!snapshot.publishedAt) {
        fail(`published ${pub.handoff_id} v${pub.version} missing publishedAt`);
      }
      const publishedAtDb = new Date(pub.published_at).toISOString();
      const publishedAtSnap = new Date(snapshot.publishedAt).toISOString();
      if (publishedAtDb !== publishedAtSnap) {
        fail(
          `published ${pub.handoff_id} v${pub.version} publishedAt mismatch (${publishedAtSnap} vs ${publishedAtDb})`,
        );
      }
      if (!Array.isArray(snapshot.items)) {
        fail(`published ${pub.handoff_id} v${pub.version} items is not an array`);
      }

      const handoff = handoffs.rows.find((row) => row.id === pub.handoff_id);
      if (!handoff) {
        fail(`published ${pub.handoff_id} v${pub.version} has no handoff row`);
      }
      const conversationId = handoff.source_conversation_id;

      for (const item of snapshot.items) {
        stats.publishedItems += 1;
        for (const field of ["id", "type", "statement", "priority", "createdBy"]) {
          if (item[field] === undefined || item[field] === null || item[field] === "") {
            fail(`published ${pub.handoff_id} v${pub.version} item missing ${field}`);
          }
        }
        if (!Array.isArray(item.sources)) {
          fail(`published ${pub.handoff_id} v${pub.version} item ${item.id} missing sources array`);
        }
        for (const source of item.sources) {
          stats.sourceReferences += 1;
          if (!source.messageId || String(source.messageId).trim() === "") {
            fail(`empty messageId on ${pub.handoff_id} v${pub.version} item ${item.id}`);
          }
          if (source.excerpt !== undefined && String(source.excerpt).trim() === "") {
            fail(`blank excerpt on ${pub.handoff_id} v${pub.version} item ${item.id}`);
          }
          const message = await client.query(
            `SELECT id, conversation_id, content FROM source_messages WHERE id = $1`,
            [source.messageId],
          );
          if (message.rowCount === 0) {
            fail(`missing message ${source.messageId} for ${pub.handoff_id} v${pub.version} item ${item.id}`);
          }
          if (message.rows[0].conversation_id !== conversationId) {
            fail(`message ${source.messageId} wrong conversation for handoff ${pub.handoff_id}`);
          }
          if (source.excerpt !== undefined && !message.rows[0].content.includes(source.excerpt)) {
            fail(`excerpt not in message ${source.messageId} for ${pub.handoff_id} v${pub.version}`);
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

    console.log("M12 provenance migration preflight PASS");
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
