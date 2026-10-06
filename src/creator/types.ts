export type CreatorId = string;

export type CreatorLifecycleStatus = "active" | "erasing";

export type CreatorPrincipal = {
  creatorId: CreatorId;
  lifecycleStatus: CreatorLifecycleStatus;
};

export const LEGACY_PRE_M9_CREATOR_ID = "creator_legacy_pre_m9";
