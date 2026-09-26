import { generateOpaqueId } from "../ids.js";
import { normalizeExternalIdentity, type VerifiedExternalAccount } from "../../creator/external-identity.js";
import type { CreatorId } from "../../creator/types.js";
import type { getRepositories } from "../runtime.js";

type Repos = ReturnType<typeof getRepositories>;

export async function resolveOrCreateCreatorForExternalIdentity(
  repos: Repos,
  account: VerifiedExternalAccount,
): Promise<CreatorId> {
  const { provider, subject } = normalizeExternalIdentity(account);
  if (!provider || !subject) {
    throw new Error("External identity requires provider and subject");
  }
  return repos.externalIdentities.resolveOrCreate({
    provider,
    subject,
    candidateCreatorId: generateOpaqueId("creator"),
    createdAt: new Date().toISOString(),
  });
}
