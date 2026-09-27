import type { CreatorId } from "../../creator/types.js";
import type { CreatorHandoffSummary } from "../../handoff/creator-handoff-summary.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export async function listCreatorHandoffs(repos: Repos, creatorId: CreatorId): Promise<CreatorHandoffSummary[]> {
  return repos.handoffs.listSummariesForOwner(creatorId);
}
