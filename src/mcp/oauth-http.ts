import { receiverStyles } from "./presentation.js";
import express, { type Response, type RequestHandler } from "express";
import { authorizationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { revocationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";
import { createScopedMcpHandler } from "./server.js";
import { connectionCookie, transactionCookie, opaque, opaquePattern, type AnonymousOAuth } from "./oauth.js";
import { hash } from "./scoped-handoff.js";
import { handoverLandingScript, authorizationHandoverScript, handoverReceiptScript } from "./handover.js";

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]!));
const cookieOptions = { secure: true, httpOnly: true, sameSite: "lax" as const, path: "/" };
const fail = (res: Response, status = 400) => res.status(status).json({ error: "invalid_request" });
// A conservative shared bucket per warm instance and endpoint. Do not infer a
// trusted client IP from proxy headers. SDK limits/windows remain unchanged;
// this is not a distributed or per-user abuse-control guarantee.
const alphaRateLimit = { keyGenerator: () => "hermeneus-synthetic-alpha" };
function cookie(raw: string | undefined, name: string) {
  const matches = (raw ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(name + "="));
  if (matches.length !== 1) return "";
  const value = matches[0]!.slice(name.length + 1); return opaquePattern.test(value) ? value : "";
}
function html(res: Response, title: string, body: string, script = "") {
  const nonce = opaque();
  // no-referrer turns navigation-form POST Origin into "null" in Chromium.
  // OAuth-only pages disclose at most this HTTPS origin, never a query/code/body.
  // MCP/answer-widget responses retain no-referrer.
  res.setHeader("Referrer-Policy", "strict-origin");
  res.setHeader("Content-Security-Policy", `default-src 'none'; connect-src 'self'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`);
  return res.type("html").send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${receiverStyles}</style></head><body><main><header class="brand">Hermeneus</header><section class="card">${body}</section></main>${script ? `<script nonce="${nonce}">${script}</script>` : ""}</body></html>`);
}
/** Explicit local factory, disabled by default. No live app imports this module. */
export function createAnonymousOAuthApp(auth: AnonymousOAuth, options: { enabled?: boolean; shareOrigin: string; pluginUrl?:string }) {
  if (new URL(options.shareOrigin).protocol !== "https:" || new URL(options.shareOrigin).origin !== options.shareOrigin || new URL(auth.resource).origin!==auth.origin) throw Error("OAuth configuration unavailable");
  if(options.pluginUrl&&!/^https:\/\/chatgpt\.com\/plugins\/[A-Za-z0-9_-]+$/.test(options.pluginUrl))throw Error("Plugin configuration unavailable");
  const app = express(); app.disable("x-powered-by"); app.set("query parser", "simple");
  app.use((req, res, next) => {
    res.set({ "Cache-Control":"no-store", "Pragma":"no-cache", "Referrer-Policy":"no-referrer", "X-Content-Type-Options":"nosniff", "X-Frame-Options":"DENY" });
    if (!options.enabled) { res.status(404).end(); return; }
    // The platform adapter must preserve the configured HTTPS origin; forwarded headers are not trusted here.
    if (req.get("host") !== new URL(auth.issuer).host) { fail(res); return; }
    next();
  });
  app.get("/.well-known/oauth-authorization-server", (_req,res) => res.json({ issuer:auth.issuer,
    authorization_endpoint:auth.issuer+"/authorize", token_endpoint:auth.issuer+"/token", revocation_endpoint:auth.issuer+"/revoke", jwks_uri:auth.issuer+"/jwks",
    response_types_supported:["code"], grant_types_supported:["authorization_code"], code_challenge_methods_supported:["S256"],
    token_endpoint_auth_methods_supported:["none"], revocation_endpoint_auth_methods_supported:["none"], scopes_supported:["handoff:read","handoff:review"], authorization_response_iss_parameter_supported:true }));
  app.get("/jwks", (_req,res) => res.json(auth.jwks));
  app.get("/handoff",(req,res)=>{
    if(Object.keys(req.query).length){fail(res);return;}
    html(res,"내 ChatGPT로 전달",`<h1>전달본을 내 ChatGPT에 연결</h1><h2>1. 전달할 공유 건 확인</h2><p id="version">공유 링크 확인 중…</p><aside id="summary"></aside><p>선택한 전달본만 연결합니다. 공유 링크의 비밀 토큰·계정 정보·전체 대화는 AI에 보내지 않습니다. ChatGPT의 처리·보관 정책은 별도입니다.</p><div class="notice"><strong>의미 검증은 실행하지 않습니다.</strong><br>이 시험에서는 원문 전달과 구조·버전만 확인합니다.</div><label><input type="checkbox" id="transfer" disabled> 이 전달본에 대한 접근을 내 ChatGPT에 허용하겠습니다.</label><h2>2. ChatGPT에서 연결 승인</h2><button id="open-plugin" disabled>ChatGPT 플러그인 연결 열기</button><p>이 화면을 열어 두세요. OAuth 승인 화면에 이 공유 건이 나타나면 선택하고 연결을 승인하세요. 플러그인을 여는 것만으로 위임되지는 않습니다.</p><h2>3. 연결 완료 후 새 대화 시작</h2><p>승인 화면에서 “AI 연결 완료하기”를 누른 뒤 돌아오세요. 새 Chat에서 Hermeneus 플러그인을 직접 선택해주세요.</p><code id="context-ref"></code><button id="open-chat" disabled>연결 완료 후 새 Chat 열기</button><p id="status" role="status"></p>`,handoverLandingScript(options.pluginUrl));
  });
  app.post("/handoff/preview",express.json({limit:1024}),(req,res)=>{
    if(req.get("origin")!==auth.origin||!req.is("application/json")||!req.body||Object.keys(req.body).length!==1||typeof req.body.shareBearer!=="string"){fail(res);return;}
    void auth.previewShare(req.body.shareBearer).then(p=>res.json(p)).catch(()=>fail(res));
  });
  const provider = { ...auth.provider, async authorize(client: Parameters<typeof auth.provider.authorize>[0], params: Parameters<typeof auth.provider.authorize>[1], res: Response) {
    const b = await auth.begin(client.client_id, params);
    res.cookie(transactionCookie(b.ref), b.cookie, { ...cookieOptions, maxAge: Math.max(0,b.expiresAt-auth.now()) });
    html(res,"Hermeneus 연결 승인",`<h1>이 공유 건을 내 AI에 연결</h1><p>${escape(b.clientName)}에 선택한 전달본 조회와 답변 검토 준비만 허용합니다.</p><aside>연결은 최대 60분, 공유 건별 위임은 최대 30분입니다. 계정·이메일을 요청하지 않습니다. 공유 링크의 비밀 토큰은 AI에 보내지 않습니다. 의미 검증 API는 호출하지 않습니다. AI 서비스의 보관 정책은 별도입니다.</aside><p>열어 둔 공유 건을 선택하거나 원래 Hermeneus 공유 링크를 직접 붙여 넣으세요. 링크의 비밀 토큰은 주소창에 넣지 않고 서버에 전송합니다.</p>
      <form method="post" action="/approve" id="approve"><input type="hidden" name="ref" value="${escape(b.ref)}"><input type="hidden" name="csrf" value="${escape(b.csrf)}"><input type="hidden" name="requestNonce" id="request-nonce" value=""><fieldset><legend>연결할 공유 건</legend><div id="handoff-offers"></div><label><input type="radio" name="flowRef" value="" checked> 원래 공유 링크 직접 입력</label></fieldset><label for="share-link">확인할 공유 링크</label><input id="share-link" type="password" autocomplete="off" required><input name="shareBearer" type="hidden" id="bearer"><label><input type="checkbox" name="confirmed" value="yes" required> 이 공유 건을 위 범위로 연결하겠습니다.</label><button id="approve-button" type="submit">선택한 공유 건 연결</button><button type="submit" name="deny" value="yes" formnovalidate>취소</button></form><p id="status" role="status"></p>`,
      authorizationHandoverScript(b.ref,b.expiresAt-auth.now(),options.shareOrigin));
  } };
  // SDK validates standard OAuth requests. Add stricter fixed-client, no-duplicate and no-echo boundaries.
  const allowedQuery = new Set(["client_id","redirect_uri","response_type","code_challenge","code_challenge_method","scope","state","resource","ui_locales"]);
  app.use("/authorize", (req,res,next) => {
    if (req.method!=="GET") { fail(res,405);return; }
    if (Object.entries(req.query).some(([k,v]) => !allowedQuery.has(k) || typeof v !== "string" || v.length>1024)) { fail(res); return; }
    // ChatGPT sends this optional presentation hint even without OIDC. It never
    // affects authorization, is not persisted/reflected, and cannot smuggle URLs.
    const locales=req.query.ui_locales;
    if(locales!==undefined&&(typeof locales!=="string"||locales.length>128||!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*(?: [A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*){0,7}$/.test(locales))){fail(res);return;}
    const redirect = req.query.redirect_uri, clientId=req.query.client_id;
    void Promise.resolve(typeof clientId==="string" ? auth.provider.clientsStore.getClient(clientId) : undefined).then(c=>{
      if (!c || typeof redirect!=="string" || !c.redirect_uris.includes(redirect)) { fail(res); return; }
      // All SDK success/error redirects carry RFC 9207 iss, including validation failures.
      const original = res.redirect.bind(res);
      res.redirect = ((status: number, url: string) => { const target=new URL(url);target.searchParams.set("iss",auth.issuer);return original(status,target.href); }) as Response["redirect"];
      next();
    }).catch(()=>fail(res));
  }, authorizationHandler({provider,rateLimit:alphaRateLimit}));
  app.use(express.urlencoded({ extended:false,limit:4096,parameterLimit:12 }));
  const formOnly: RequestHandler = (req,res,next) => {
    if (!req.is("application/x-www-form-urlencoded") || !req.body || Object.values(req.body).some(v=>typeof v!=="string")) { fail(res);return; } next();
  };
  const sameOrigin: RequestHandler = (req,res,next) => { if (req.get("origin")!==auth.origin) { fail(res);return; } next(); };
  app.post("/approve",sameOrigin,formOnly,async(req,res)=>{
    try {
      const {ref,csrf,shareBearer,confirmed,deny,flowRef,requestNonce}=req.body as Record<string,string>;
      if (!ref || !csrf || Object.keys(req.body).some(k=>!["ref","csrf","shareBearer","confirmed","deny","flowRef","requestNonce"].includes(k)) || (flowRef&&!opaquePattern.test(flowRef)) || (requestNonce&&!opaquePattern.test(requestNonce))) { fail(res);return; }
      const r=await auth.approve({ref,csrf,cookie:cookie(req.get("cookie"),transactionCookie(ref)),confirmed:confirmed==="yes"&&deny!=="yes",shareBearer});
      res.clearCookie(transactionCookie(ref),cookieOptions);
      if (!r.sessionId) {
        // form-action 'self' blocks an external 303 chain. Start a new navigation
        // from the denied response instead; the destination is the exact registered callback.
        html(res,"연결 취소",`<h1>연결을 취소했습니다</h1><a id="return-to-ai" href="${escape(r.redirect)}" rel="noreferrer">AI로 돌아가기</a>`,
          `location.replace(${JSON.stringify(r.redirect).replace(/</g,"\\u003c")});`);return;
      }
      res.cookie(connectionCookie(r.sessionId),r.browser,{...cookieOptions,maxAge:Math.max(0,r.expiresAt-auth.now())});
      html(res,"Hermeneus 연결 준비",`<h1>버전 ${r.version} 연결 준비 완료</h1><p>아래 식별 코드는 연결한 전달본을 찾는 데 쓰입니다. 코드만으로는 접근할 수 없습니다.</p><code id="context-ref">${escape(r.contextRef)}</code><p>AI 연결을 완료한 뒤 원래 연결 화면으로 돌아가 새 Chat을 여세요. 코드는 60초 안에 교환해야 합니다.</p><a id="continue" href="${escape(r.redirect)}" rel="noreferrer">AI 연결 완료하기</a><form action="/disconnect" method="post"><input type="hidden" name="session" value="${escape(r.sessionId)}"><input type="hidden" name="csrf" value="${escape(r.csrf)}"><button type="submit">이 연결 해제</button></form><p>답변·질문·동의는 저장하지 않았습니다. 아직 의미 검증을 수행하지 않았습니다.</p>`,
        flowRef&&requestNonce?handoverReceiptScript({flowRef,requestNonce,transactionRef:ref,fingerprint:hash(shareBearer!),contextRef:r.contextRef}):"");
    } catch { fail(res); }
  });
  app.post("/disconnect",sameOrigin,formOnly,async(req,res)=>{
    try {
      const {session,csrf}=req.body as Record<string,string>;
      if (!session || !csrf || Object.keys(req.body).some(k=>!["session","csrf"].includes(k))) { fail(res);return; }
      await auth.disconnect(session,cookie(req.get("cookie"),connectionCookie(session)),csrf);
      res.clearCookie(connectionCookie(session),cookieOptions); html(res,"연결 해제", "<h1>연결을 해제했습니다</h1><p>이 연결의 향후 접근은 차단됩니다. 원래 공유 링크는 유지됩니다.</p>");
    } catch { fail(res); }
  });
  const protocolBody = (allowed: readonly string[]): RequestHandler => (req,res,next) => {
    if (req.get("authorization") || Object.keys(req.body).some(k=>!allowed.includes(k))) { fail(res);return; } next();
  };
  app.use("/token",formOnly,protocolBody(["client_id","grant_type","code","code_verifier","redirect_uri","resource"]),(req,res,next)=>{
    if (req.body.grant_type==="authorization_code" && (!opaquePattern.test(req.body.code??"") || !/^[A-Za-z0-9_.~-]{43,128}$/.test(req.body.code_verifier??""))) { fail(res);return; } next();
  },tokenHandler({provider:auth.provider,rateLimit:alphaRateLimit}));
  app.use("/revoke",formOnly,protocolBody(["client_id","token","token_type_hint"]),revocationHandler({provider:auth.provider,rateLimit:alphaRateLimit}));
  const handleMcp=createScopedMcpHandler({service:auth.service,resource:auth.resource,issuer:auth.issuer,enabled:true});
  app.use(async(req,res,next)=>{
    if (![new URL(auth.resource).pathname,"/.well-known/oauth-protected-resource"].includes(req.path)) { next();return; }
    try {
      if(req.method==="POST"&&!req.is("application/json")){fail(res,415);return;}
      if(Number(req.get("content-length"))>90_000){fail(res,413);return;}
      const body = req.method==="POST" ? await new Promise<Buffer>((resolve,reject)=>{let size=0;const chunks:Buffer[]=[];req.on("data",(c:Buffer)=>{size+=c.length;if(size>90_000){reject(Error("too large"));req.destroy();}else chunks.push(c);});req.on("end",()=>resolve(Buffer.concat(chunks)));req.on("error",reject);}) : undefined;
      const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(","):v);
      const response=await handleMcp(new Request(auth.origin+req.originalUrl,{method:req.method,headers,body:body?new Uint8Array(body):undefined}));
      res.status(response.status);response.headers.forEach((v,k)=>res.setHeader(k,v));res.send(Buffer.from(await response.arrayBuffer()));
    } catch { fail(res); }
  });
  app.use((_req,res)=>res.status(404).end());
  // Deliberately no request/error logger; never echo parser errors or sensitive input.
  app.use(((err, _req, res, _next) => { void err;fail(res); }) as express.ErrorRequestHandler);
  return app;
}
