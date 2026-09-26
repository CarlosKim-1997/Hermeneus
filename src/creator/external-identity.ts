import type { CreatorId } from "./types.js";

export type ExternalIdentity = {
  provider: string;
  subject: string;
};

export function normalizeExternalIdentity(input: ExternalIdentity): ExternalIdentity {
  return {
    provider: input.provider.trim().toLowerCase(),
    subject: input.subject.trim(),
  };
}

export type VerifiedExternalAccount = ExternalIdentity;
