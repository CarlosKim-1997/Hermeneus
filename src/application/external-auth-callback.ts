import type { CreatorId } from "../creator/types.js";
import { getRepositories } from "./runtime.js";
import { resolveOrCreateCreatorForExternalIdentity } from "./use-cases/resolve-external-creator.js";

export type ExternalAuthToken = {
  creatorId?: CreatorId;
};

export type VerifiedAuthJsAccount = {
  provider?: string | null;
  providerAccountId?: string | null;
};

export async function mapVerifiedExternalAccountToCreatorId(
  account: VerifiedAuthJsAccount | null | undefined,
): Promise<CreatorId | undefined> {
  if (!account?.provider || !account.providerAccountId) {
    return undefined;
  }
  const repos = getRepositories();
  return resolveOrCreateCreatorForExternalIdentity(repos, {
    provider: account.provider,
    subject: account.providerAccountId,
  });
}

export async function applyVerifiedExternalAccountToToken(
  token: ExternalAuthToken,
  account: VerifiedAuthJsAccount | null | undefined,
): Promise<ExternalAuthToken> {
  const creatorId = await mapVerifiedExternalAccountToCreatorId(account);
  if (creatorId) {
    token.creatorId = creatorId;
  }
  return token;
}

export function readCreatorIdFromExternalAuthToken(token: ExternalAuthToken | null | undefined): CreatorId | undefined {
  const creatorId = token?.creatorId;
  return typeof creatorId === "string" && creatorId.length > 0 ? creatorId : undefined;
}
