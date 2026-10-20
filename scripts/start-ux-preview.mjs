import {build} from "esbuild";
import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
const root=resolve("."),out=resolve("dist/t029-ux-preview");await mkdir(out,{recursive:true});
const alias={"next/link":resolve("scripts/ux-preview/link.tsx"),"next/navigation":resolve("scripts/ux-preview/navigation.ts")};
const plugin={name:"preview-only-actions",setup(b){b.onResolve({filter:/application\/(?:share-actions|receiver-actions|account-actions|auth-actions|actions)(?:\.js)?$/},()=>({path:resolve("scripts/ux-preview/actions.ts")}));}};
const common={bundle:true,jsx:"automatic",alias,plugins:[plugin],logLevel:"warning"};
await build({...common,entryPoints:["scripts/ux-preview/client.tsx"],outfile:resolve(out,"client.js"),platform:"browser",format:"esm",define:{"process.env.NODE_ENV":'"development"'}});
await build({...common,entryPoints:["scripts/ux-preview/render.tsx"],outfile:resolve(out,"render.mjs"),platform:"node",format:"esm",packages:"external"});
const {render,items,handoffId,packet,verdict}=await import(pathToFileURL(resolve(out,"render.mjs")).href);
const extra=`.preview-banner{background:#203b35;color:#fff;padding:.6rem 1rem;font:12px/1.6 system-ui;display:flex;gap:1rem;flex-wrap:wrap}.preview-nav{display:flex;flex-wrap:wrap;gap:.5rem 1rem;margin-bottom:1.5rem;font-size:12px}.preview-nav a[aria-current]{font-weight:700;text-decoration-thickness:2px}`;
const server=createServer(async(req,res)=>{
  res.setHeader("cache-control","no-store");res.setHeader("x-content-type-options","nosniff");res.setHeader("referrer-policy","no-referrer");
  const address=server.address();if(req.headers.host!==`127.0.0.1:${address.port}`){res.writeHead(403);res.end();return;}
  const url=new URL(req.url,"http://127.0.0.1");
  try{
    if(url.pathname==="/__preview/action"&&req.method==="POST"){
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end();return;}
      let body="";for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>120000){res.writeHead(413);res.end();return;}}
      const {action,args}=JSON.parse(body);let result={ok:false,error:{message:"디자인 미리보기에서는 실제 데이터를 바꾸지 않습니다.",code:"PREVIEW_ONLY"}};
      if(action==="bootstrap")result={ok:true,handoffId};
      if(action==="save")result={ok:true,revision:3};
      if(action==="suggest")result={ok:true,suggestions:[]};
      if(action==="packet")result={ok:true,packet};
      if(action==="verify")result={ok:true,result:verdict};
      if(action==="question")result={ok:true,answer:{classification:"OPEN",answer:items[2].statement,citedItems:[items[2]]}};
      if(action==="provenance")result={ok:true,provenance:{items:[{itemId:items[2].id,references:[]}]}};
      if(action==="list")result={ok:true,capabilities:[]};
      if(action==="share")result={ok:true,sharePath:"/share#synthetic-preview-only",capability:{id:"cap_ux_synthetic_only",version:1,createdAt:"2026-10-20T00:00:00.000Z"}};
      res.setHeader("content-type","application/json");res.end(JSON.stringify(result));return;
    }
    if(req.method!=="GET"){res.writeHead(405);res.end();return;}
    if(url.pathname==="/client.js"){res.setHeader("content-type","text/javascript");res.end(await readFile(resolve(out,"client.js")));return;}
    if(url.pathname==="/style.css"){res.setHeader("content-type","text/css");res.end(await readFile(resolve(root,"src/app/globals.css"),"utf8")+await readFile(resolve(root,"src/app/theme.css"),"utf8")+await readFile(resolve(root,"src/app/reference-ui.css"),"utf8")+extra);return;}
    if(url.pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
    res.setHeader("content-type","text/html;charset=utf-8");res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hermeneus UX · 합성 미리보기</title><link rel="stylesheet" href="/style.css"></head><body><div id="preview-root">${render(url.pathname,url.search)}</div><script type="module" src="/client.js"></script></body></html>`);
  }catch{res.writeHead(500);res.end("PREVIEW_FAILED");}
});
server.listen(Number(process.env.UX_PREVIEW_PORT||3410),"127.0.0.1",()=>console.log(`Synthetic UX preview http://127.0.0.1:${server.address().port}/library · no DB or external AI`));
