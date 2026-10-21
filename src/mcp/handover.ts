import { SHARE_TOKEN_PREFIX } from '../share/token.js';
const js = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
const sharePattern='^'+SHARE_TOKEN_PREFIX+'[A-Za-z0-9_-]{43,508}$';
/** Same-origin browser memory only. No Share secret enters OAuth URLs, Chat prompts or storage. */
export function handoverLandingScript(pluginUrl: string | undefined) {
  return `const status=document.getElementById('status'),consent=document.getElementById('transfer'),open=document.getElementById('open-plugin'),chat=document.getElementById('open-chat');
  let raw=location.hash.slice(1),preview=null,pending=null,reference=null;history.replaceState(null,'','/handoff');
  const random=()=>{const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/g,'');};
  const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v),validBearer=v=>typeof v==='string'&&new RegExp(${js(sharePattern)}).test(v),flowRef=random();
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('hermeneus.scoped-handoff/v1'):null;
  const clear=()=>{raw='';preview=null;pending=null;reference=null;consent.checked=false;consent.disabled=true;open.disabled=true;chat.disabled=true;channel?.close();};
  async function start(){if(!validBearer(raw)){clear();status.textContent='원래 공유 링크를 다시 열어 연결해주세요.';return;}
    try{const r=await fetch('/handoff/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({shareBearer:raw}),cache:'no-store'});if(!r.ok)throw Error();preview=await r.json();
      document.getElementById('version').textContent='공유받은 버전 '+preview.version;document.getElementById('summary').textContent=preview.summary;status.textContent='범위를 확인하고 ChatGPT 연결을 여세요.';
      consent.disabled=false;if(!channel)status.textContent='이 브라우저는 자동 인계를 지원하지 않습니다. OAuth 승인 화면에 원래 공유 링크를 직접 붙여넣어주세요.';
    }catch{clear();status.textContent='이 공유 링크를 열 수 없습니다. 보낸 사람에게 새 링크를 요청해주세요.';}}
  consent.onchange=()=>{open.disabled=!consent.checked||!preview||!${js(!!pluginUrl)};};
  open.onclick=()=>{if(consent.checked&&preview&&${js(!!pluginUrl)})window.open(${js(pluginUrl ?? "https://chatgpt.com/")},'_blank','noopener,noreferrer');};
  chat.onclick=()=>{if(!reference)return;const prompt='Hermeneus 플러그인을 선택한 뒤 get_handoff_packet으로 contextRef '+reference+'의 전달본을 읽어줘. 확정·미정·알 수 없음을 구분하고 Canon에 없는 보낸 사람의 의도를 만들지 마. 내가 지정한 답변만 Hermeneus 위젯으로 보내줘. 검사는 구조 확인이며 의미 검증 성공을 뜻하지 않아.';window.open('https://chatgpt.com/?q='+encodeURIComponent(prompt),'_blank','noopener,noreferrer');};
  if(channel)channel.onmessage=e=>{const m=e.data;if(!m||!preview||!consent.checked)return;
    if(m.type==='discover'&&valid(m.transactionRef)&&valid(m.discoveryNonce)&&raw){channel.postMessage({type:'offer',transactionRef:m.transactionRef,discoveryNonce:m.discoveryNonce,flowRef,version:preview.version,publicationRef:preview.publicationRef,fingerprint:preview.fingerprint,summary:preview.summary});}
    if(m.type==='request'&&m.flowRef===flowRef&&valid(m.transactionRef)&&valid(m.requestNonce)&&raw){pending={transactionRef:m.transactionRef,requestNonce:m.requestNonce};channel.postMessage({type:'bearer',flowRef,...pending,bearer:raw});}
    if(m.type==='delegated'&&m.flowRef===flowRef&&pending&&m.transactionRef===pending.transactionRef&&m.requestNonce===pending.requestNonce&&m.fingerprint===preview.fingerprint&&valid(m.contextRef)){
      raw='';reference=m.contextRef;pending=null;document.getElementById('context-ref').textContent=reference;chat.disabled=false;open.disabled=true;consent.disabled=true;status.textContent='공유 건 위임 준비 완료. OAuth 화면에서 “AI 연결 완료하기”를 누른 뒤 새 Chat을 여세요. 연결할 플러그인은 직접 선택해주세요.';}}
  window.addEventListener('pagehide',clear,{once:true});setTimeout(()=>{clear();status.textContent='인계 시간이 만료됐습니다. 원래 공유 링크에서 다시 시작해주세요.';},1800000);void start();`;
}

export function authorizationHandoverScript(ref: string, expiresIn: number, shareOrigin: string) {
  return `const form=document.getElementById('approve'),input=document.getElementById('share-link'),bearer=document.getElementById('bearer'),status=document.getElementById('status'),offers=document.getElementById('handoff-offers'),requestField=document.getElementById('request-nonce');
  const valid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v),validBearer=v=>typeof v==='string'&&new RegExp(${js(sharePattern)}).test(v),random=()=>{const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/g,'');};
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('hermeneus.scoped-handoff/v1'):null,transactionRef=${js(ref)},discoveryNonce=random(),known=new Map();let pending=null;
  const selected=()=>form.querySelector('input[name="flowRef"]:checked')?.value??'';
  form.addEventListener('change',()=>{input.required=!selected();pending=null;document.getElementById('approve-button').disabled=false;});
  const discover=()=>channel?.postMessage({type:'discover',transactionRef,discoveryNonce});const poll=setInterval(discover,1000);discover();
  if(channel)channel.onmessage=async e=>{const m=e.data;if(!m||m.transactionRef!==transactionRef)return;
    if(m.type==='offer'&&m.discoveryNonce===discoveryNonce&&valid(m.flowRef)&&typeof m.fingerprint==='string'&&/^[a-f0-9]{64}$/.test(m.fingerprint)&&Number.isSafeInteger(m.version)&&m.version>0&&typeof m.summary==='string'&&m.summary.length<=180&&!known.has(m.flowRef)){
      known.set(m.flowRef,m);const label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='flowRef';radio.value=m.flowRef;label.append(radio,document.createTextNode(' 열어 둔 공유 건 · 버전 '+m.version+' · '+m.fingerprint.slice(0,10)+' — '+m.summary));offers.append(label);}
    if(m.type==='bearer'&&pending&&m.flowRef===pending.flowRef&&m.requestNonce===pending.requestNonce&&selected()===m.flowRef&&validBearer(m.bearer)){
      const observed=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(m.bearer)))].map(v=>v.toString(16).padStart(2,'0')).join('');
      if(!pending||m.requestNonce!==pending.requestNonce||observed!==known.get(m.flowRef)?.fingerprint)return;
      bearer.value=m.bearer;requestField.value=m.requestNonce;input.value='';form.submit();}}
  form.addEventListener('submit',e=>{if(e.submitter?.name==='deny'){input.value='';bearer.value='';return;}
    const flowRef=selected();if(flowRef){e.preventDefault();if(!known.has(flowRef)||!channel||pending)return;const requestNonce=random();pending={flowRef,requestNonce};document.getElementById('approve-button').disabled=true;channel.postMessage({type:'request',transactionRef,flowRef,requestNonce});
      setTimeout(()=>{if(pending?.requestNonce===requestNonce){pending=null;document.getElementById('approve-button').disabled=false;status.textContent='원래 연결 화면을 열어 둔 상태인지 확인하거나 공유 링크를 직접 입력해주세요.';}},5000);return;}
    try{const u=new URL(input.value);if(u.origin!==${js(shareOrigin)}||u.pathname!=='/share'||u.search||!validBearer(u.hash.slice(1)))throw Error();bearer.value=u.hash.slice(1);input.value='';}catch{e.preventDefault();status.textContent='원래 Hermeneus 공유 링크를 확인해주세요.';}});
  const clear=()=>{clearInterval(poll);input.value='';bearer.value='';pending=null;known.clear();channel?.close();};window.addEventListener('pagehide',clear,{once:true});
  setTimeout(()=>{clear();for(const e of form.elements)e.disabled=true;status.textContent='승인 시간이 만료됐습니다. AI에서 연결을 다시 시작해주세요.';},${Math.max(0,expiresIn)});`;
}

export function handoverReceiptScript(input: {flowRef:string;requestNonce:string;transactionRef:string;fingerprint:string;contextRef:string}) {
  return `if(typeof BroadcastChannel==='function'){const c=new BroadcastChannel('hermeneus.scoped-handoff/v1');c.postMessage(${js({type:"delegated",...input})});c.close();}`;
}
