export const handoffId="hd_ux_synthetic";
export const items = [
  {id:"ux-1",type:"CORE_INTENT" as const,priority:"CORE" as const,statement:"금요일까지 웹 화면 초안을 부탁드립니다. 검토할 수 있는 형태의 화면 흐름이 필요합니다.",createdBy:"CREATOR" as const,sources:[]},
  {id:"ux-2",type:"CONTEXT" as const,priority:"IMPORTANT" as const,statement:"다음 주 동료 검토를 앞두고, 먼저 사용자가 업무를 전달하는 흐름부터 확인하려고 합니다.",createdBy:"CREATOR" as const,sources:[]},
  {id:"ux-3",type:"OPEN" as const,priority:"CORE" as const,statement:"모바일 화면의 담당자와 일정은 아직 정하지 않았습니다.",createdBy:"CREATOR" as const,sources:[]},
];
export const publishedAt="2026-10-20T00:00:00.000Z";
export const handoffs=[
  {handoffId,displayTitle:"웹 화면 초안 요청",draftRevision:2,draftUpdatedAt:"2026-10-19T23:30:05.000Z",createdAt:publishedAt,latestPublishedVersion:1,latestPublishedAt:publishedAt},
  {handoffId:"hd_ux_draft",displayTitle:"동료 검토 전에 정리할 배경",draftRevision:1,draftUpdatedAt:publishedAt,createdAt:publishedAt},
];
