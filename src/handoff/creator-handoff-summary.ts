export type CreatorHandoffSummary = {
  handoffId: string;
  createdAt: string;
  draftRevision: number;
  draftUpdatedAt: string;
  latestPublishedVersion?: number;
  latestPublishedAt?: string;
};
