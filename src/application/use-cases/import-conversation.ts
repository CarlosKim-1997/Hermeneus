import { createDraft } from "../../handoff/draft.js";
import { importConversation } from "../../import/registry.js";
import type { CreatorId } from "../../creator/types.js";
import { generateOpaqueId } from "../ids.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export async function importAndCreateHandoff(repos: Repos, ownerCreatorId: CreatorId, transcript: string) {
  const conversationId = generateOpaqueId("conv");
  const handoffId = generateOpaqueId("hd");
  const importedAt = new Date().toISOString();
  const normalized = await importConversation({
    text: transcript,
    importedAt,
    conversationId,
  });
  const conversation = { ...normalized, id: conversationId };

  const saved = await repos.importHandoff.importHandoffAtomic({
    ownerCreatorId,
    conversation,
    handoffId,
    draft: createDraft(handoffId, []),
  });

  return { handoffId, conversationId, revision: saved.revision };
}
