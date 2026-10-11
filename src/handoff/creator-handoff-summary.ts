export type CreatorHandoffSummary = {
  handoffId: string;
  displayTitle?: string;
  createdAt: string;
  draftRevision: number;
  draftUpdatedAt: string;
  latestPublishedVersion?: number;
  latestPublishedAt?: string;
};
