import { generateOpaqueId } from "../ids.js";
import type { getRepositories } from "../runtime.js";
import type { ShareCapabilityIssueResult, ShareCapabilityMetadata, ShareCapabilityTarget } from "../../share/types.js";
import { generateShareToken, hashShareToken, isShareTokenFormat } from "../../share/token.js";

type Repos = ReturnType<typeof getRepositories>;

export class ShareCapabilityError extends Error {
  constructor(
    readonly code: "NOT_PUBLISHED" | "INVALID_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "ShareCapabilityError";
  }
}

export async function issueShareCapability(
  repos: Repos,
  input: { handoffId: string; version: number },
): Promise<ShareCapabilityIssueResult> {
  if (!Number.isInteger(input.version) || input.version <= 0) {
    throw new ShareCapabilityError("INVALID_INPUT", "Version must be a positive integer.");
  }

  const published = await repos.published.get(input.handoffId, input.version);
  if (!published) {
    throw new ShareCapabilityError("NOT_PUBLISHED", "Only a published Handoff version can be shared.");
  }

  const rawToken = generateShareToken();
  const tokenHash = hashShareToken(rawToken);
  const createdAt = new Date().toISOString();
  const metadata = await repos.shareCapabilities.create({
    id: generateOpaqueId("shcap"),
    handoffId: input.handoffId,
    version: input.version,
    tokenHash,
    createdAt,
  });

  return { metadata, rawToken };
}

export async function revokeShareCapability(
  repos: Repos,
  input: { capabilityId: string },
): Promise<ShareCapabilityMetadata | undefined> {
  return repos.shareCapabilities.revoke(input.capabilityId, new Date().toISOString());
}

export async function listShareCapabilitiesForVersion(
  repos: Repos,
  handoffId: string,
  version: number,
): Promise<ShareCapabilityMetadata[]> {
  return repos.shareCapabilities.listForPublishedVersion(handoffId, version);
}

export async function resolveActiveShareTarget(
  repos: Repos,
  rawToken: string,
): Promise<ShareCapabilityTarget | undefined> {
  const trimmed = rawToken.trim();
  if (!isShareTokenFormat(trimmed)) return undefined;
  return repos.shareCapabilities.resolveActiveByTokenHash(hashShareToken(trimmed));
}
