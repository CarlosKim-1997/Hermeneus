import type { CreatorId } from "../../creator/types.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export async function initiateAccountErasure(repos: Repos, creatorId: CreatorId) {
  await repos.accountErasure.enterErasingPhase(creatorId);
  await repos.accountErasure.completeAccountErasure(creatorId);
}

export async function retryAccountErasure(repos: Repos, creatorId: CreatorId) {
  await repos.accountErasure.completeAccountErasure(creatorId);
}
