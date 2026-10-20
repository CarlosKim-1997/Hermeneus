// Only the preview bundler aliases production action imports to this module.
async function request(action:string,args:unknown[]){const response=await fetch("/__preview/action",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,args})});return response.json();}
export const bootstrapHandoffAction=(...args:unknown[])=>request("bootstrap",args);
export const importConversationAction=(..._args:unknown[])=>Promise.resolve({error:"디자인 미리보기에서는 대화 원문을 저장하지 않습니다."});
export const saveDraftAction=(...args:unknown[])=>request("save",args);
export const publishHandoffAction=(..._args:unknown[])=>{window.location.assign("/published");return Promise.resolve();};
export const generateExtractionSuggestionsAction=(...args:unknown[])=>request("suggest",args);
export const eraseSourceAction=(...args:unknown[])=>request("destructive",args);
export const deleteHandoffAction=(...args:unknown[])=>request("destructive",args);
export const deleteAccountAction=(...args:unknown[])=>request("destructive",args);
export const retryAccountErasureAction=(...args:unknown[])=>request("destructive",args);
export const issueShareCapabilityAction=(...args:unknown[])=>request("share",args);
export const listShareCapabilitiesAction=(...args:unknown[])=>request("list",args);
export const revokeShareCapabilityAction=(...args:unknown[])=>request("destructive",args);
export const askSharedReceiverQuestionAction=(...args:unknown[])=>request("question",args);
export const askReceiverQuestionAction=(...args:unknown[])=>request("question",args);
export const fetchSharedReceiverProvenanceAction=(...args:unknown[])=>request("provenance",args);
export const fetchReceiverProvenanceAction=(...args:unknown[])=>request("provenance",args);
export const loadSharedReceiverPacketAction=(...args:unknown[])=>request("packet",args);
export const verifyExternalAnswerAction=(...args:unknown[])=>request("verify",args);
export const devSignInAction=(..._args:unknown[])=>{window.location.assign("/library");return Promise.resolve();};
export const googleSignInAction=()=>{window.location.assign("/library");};
