import { receiverStyles } from "./presentation.js";
export const REVIEW_URI = "ui://hermeneus/scoped-review-v1.html";
/** Ephemeral UI only. Server reauthorizes all inspection calls; this checkbox is no identity attestation. */
export function scopedWidgetHtml() { return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><style>${receiverStyles}</style></head><body><main>
<header class="brand">Hermeneus</header><section class="card"><h2>가져온 답변 확인</h2><p id="version"></p>
<div class="notice" id="semantic-notice"><strong>현재 의미 검증이 꺼져 있습니다.</strong><br>원문 전달과 구조·버전만 확인합니다. 답변이 전달본과 같은 뜻인지는 판단하지 않습니다.</div>
<p>선택한 답변과 줄바꿈·인용을 직접 비교하세요. 위젯은 원래 Chat과 자동 비교하지 않습니다.</p><pre id="answer"></pre><details><summary>기준 전달본·식별 정보</summary><pre id="canon"></pre><small id="digest"></small></details>
<label><input id="confirm" type="checkbox" disabled> 위 답변이 내가 선택한 원문인지 확인했습니다.</label><button id="check" disabled>확인한 원문 검사</button><p id="status" role="status">원문 연결 확인 중…</p><pre id="result" role="status" hidden></pre>
<p class="muted">Hermeneus는 답변과 동의 선택을 저장하지 않습니다. ChatGPT의 보관 정책은 별도로 적용됩니다.</p></section></main><script>${scopedWidgetScript}</script></body></html>`; }

export const scopedWidgetScript = String.raw`"use strict";
(()=>{
 const el=id=>document.getElementById(id),confirm=el("confirm"),check=el("check"),result=el("result"),status=el("status");
 let current=null,ready=false,busy=false,epoch=0,nextId=1,fingerprint=null,expiryTimer=null;const pending=new Map();
 const canonical=v=>Array.isArray(v)?"["+v.map(canonical).join(",")+"]":v!==null&&typeof v==="object"?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}":JSON.stringify(v);
 const sha=async v=>"sha256:"+Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical(v)))),b=>b.toString(16).padStart(2,"0")).join("");
 function clear(message){epoch++;current=null;busy=false;confirm.checked=false;confirm.disabled=true;check.disabled=true;result.hidden=true;result.textContent="";for(const id of ["answer","canon","digest","version"])el(id).textContent="";clearTimeout(expiryTimer);status.textContent=message;}
 function update(){check.disabled=!ready||!current||!confirm.checked||busy;}
 function rpc(method,params){const id=nextId++;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error("HOST_TIMEOUT"));},15000);pending.set(id,{resolve,reject,timer});window.parent.postMessage({jsonrpc:"2.0",id,method,params},"*");});}
 async function hydrate(data){
  clear("원문 연결 확인 중…");const seq=epoch;
  try{
   const {packet,submission}=data,core={...packet};delete core.canonicalDigest;
   if(data.protocol!=="hermeneus.scoped-review/v0"||typeof data.contextRef!=="string"||!packet||packet.protocol!=="hermeneus.receiver-packet/v0"||
      !Number.isInteger(packet.version)||packet.version<1||!Array.isArray(packet.items)||!packet.items.length||
      !submission||submission.protocol!=="hermeneus.receiver-submission/v0"||typeof submission.answerText!=="string"||submission.answerText.length>20000||
      submission.publicationRef!==packet.publicationRef||submission.packetDigest!==packet.canonicalDigest||
      typeof data.reviewTicket!=="string"||!Number.isSafeInteger(data.expiresAt)||data.expiresAt<=Date.now()||
      await sha(core)!==packet.canonicalDigest||await sha(submission)!==data.submissionDigest)throw Error();
   if(seq!==epoch)return;current=JSON.parse(JSON.stringify(data));el("answer").textContent=submission.answerText;
   el("digest").textContent=data.submissionDigest;el("version").textContent="Published 버전 "+packet.version;
   el("canon").textContent=packet.items.map(i=>i.citeId+" · "+i.type+"\n"+i.statement).join("\n\n");
   confirm.disabled=false;status.textContent="선택한 답변 원문을 확인해주세요.";update();
   expiryTimer=setTimeout(()=>clear("검토 시간이 만료됐습니다. Chat에서 답변을 다시 가져오세요."),Math.min(data.expiresAt-Date.now(),60000));
  }catch{if(seq===epoch)clear("원문·버전 연결을 확인하지 못했습니다. Chat에서 다시 가져오세요.");}
 }
 function receive(value){const data=value?._meta?.hermeneusScopedReview??value?.hermeneusScopedReview;if(!data)return;try{const f=canonical(data);if(f===fingerprint)return;fingerprint=f;void hydrate(data);}catch{clear("원문 연결 실패");}}
 window.addEventListener("message",event=>{if(event.source!==window.parent||event.data?.jsonrpc!=="2.0")return;const m=event.data;
  if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error("HOST_ERROR")):p.resolve(m.result);return;}
  if(m.method==="ui/notifications/tool-result")receive(m.params);
  if(m.method==="ui/notifications/tool-input"){fingerprint=null;clear("새 답변 수신 대기 중…");}
 });
 window.addEventListener("openai:set_globals",()=>receive(window.openai?.toolResponseMetadata));
 confirm.addEventListener("change",()=>{epoch++;busy=false;result.hidden=true;result.textContent="";update();});
 check.addEventListener("click",async()=>{
  if(!current||!confirm.checked||!ready||busy)return;const data=current,seq=++epoch;busy=true;confirm.checked=false;update();result.hidden=true;status.textContent="공유 권한·구조·버전 확인 중…";
  try{
   const response=await rpc("tools/call",{name:"inspect_handoff_review",arguments:{contextRef:data.contextRef,submission:data.submission,reviewTicket:data.reviewTicket}});
   if(seq!==epoch)return;const r=response?.structuredContent;
   if(response?.isError||r?.status!=="STRUCTURE_ONLY"||r.semanticProvider!=="NOT_CONNECTED"||r.submissionDigest!==data.submissionDigest||
      r.result?.protocol!=="hermeneus.receiver-verdict/v0.1"||r.result.publicationRef!==data.packet.publicationRef||r.result.packetDigest!==data.packet.canonicalDigest||r.result.verdict!=="INDETERMINATE")throw Error();
   result.textContent="INDETERMINATE · 의미 검증 미실행\n구조·고정 버전 확인 완료. Canon 정합성은 판정하지 않았습니다.";result.hidden=false;
   status.textContent="이 원문에 대한 검사 결과입니다. 다시 검사하려면 Chat에서 새 검토를 준비하세요.";
   current=null;confirm.disabled=true; // Ticket was consumed: rechecking must not silently replay it.
  }catch{if(seq===epoch)clear("검사 결과를 확인하지 못했습니다. 접근·시간을 확인하고 Chat에서 다시 가져오세요. 자동 재시도하지 않습니다.");}
  finally{if(seq===epoch){busy=false;update();}}
 });
 window.addEventListener("pagehide",()=>{clear("화면을 닫았습니다.");for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error("CLOSED"));}pending.clear();});
 receive(window.openai?.toolResponseMetadata);
 rpc("ui/initialize",{appInfo:{name:"hermeneus-scoped-review",version:"0.1.0"},appCapabilities:{},protocolVersion:"2026-01-26"}).then(()=>{
  ready=true;window.parent.postMessage({jsonrpc:"2.0",method:"ui/notifications/initialized",params:{}},"*");receive(window.openai?.toolResponseMetadata);update();
 }).catch(()=>clear("호스트 연결 실패. 검사를 실행하지 않습니다."));
})();`;
