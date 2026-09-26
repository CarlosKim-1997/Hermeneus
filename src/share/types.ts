export type ShareCapabilityTarget = {
  handoffId: string;
  version: number;
};

export type ShareCapabilityMetadata = {
  id: string;
  handoffId: string;
  version: number;
  createdAt: string;
  revokedAt?: string;
};

export type ShareCapabilityIssueResult = {
  metadata: ShareCapabilityMetadata;
  rawToken: string;
};
