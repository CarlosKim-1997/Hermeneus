import { createDraft } from "../../handoff/draft.js";
import { importConversation } from "../../import/registry.js";
import { generateOpaqueId } from "../ids.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export async function importAndCreateHandoff(repos: Repos, transcript: string) {
  const conversationId = generateOpaqueId("conv");
  const handoffId = generateOpaqueId("hd");
  const importedAt = new Date().toISOString();
  const normalized = await importConversation({
    text: transcript,
    importedAt,
    conversationId,
  });
  const conversation = { ...normalized, id: conversationId };

  await repos.conversations.create(conversation);
  await repos.handoffs.create(handoffId, conversationId);
  const saved = await repos.drafts.save(createDraft(handoffId, []));

  return { handoffId, conversationId, revision: saved.revision };
}
