import type { CreatorId } from "../../creator/types.js";
import { HandoffLifecycleUnavailableError } from "../../persistence/errors.js";
import { HandoffAccessUnavailableError } from "../creator-auth-errors.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

function mapUnavailable(error: unknown): never {
  if (error instanceof HandoffLifecycleUnavailableError) {
    throw new HandoffAccessUnavailableError();
  }
  throw error;
}

export async function eraseHandoffSource(repos: Repos, ownerCreatorId: CreatorId, handoffId: string) {
  try {
    return await repos.erasure.eraseSource(handoffId, ownerCreatorId, new Date().toISOString());
  } catch (error) {
    mapUnavailable(error);
  }
}

export async function deleteWholeHandoff(repos: Repos, ownerCreatorId: CreatorId, handoffId: string) {
  try {
    await repos.erasure.deleteHandoff(handoffId, ownerCreatorId);
  } catch (error) {
    mapUnavailable(error);
  }
}
