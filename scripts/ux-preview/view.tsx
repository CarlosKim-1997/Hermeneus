import { useEffect } from "react";
import { HandoffLibrary } from "../../src/app/components/handoff-library";
import { CreatorNavLinks } from "../../src/app/components/creator-nav-links";
import { BootstrapForm } from "../../src/app/components/bootstrap-form";
import { SenderPromptGuide } from "../../src/app/components/sender-prompt-guide";
import { NewHandoffWorkspace } from "../../src/app/components/new-handoff-workspace";
import { PublishedDocument } from "../../src/app/components/published-document";
import { ReviewEditor } from "../../src/app/components/review-editor";
import { HandoffLifecyclePanel } from "../../src/app/components/handoff-lifecycle-panel";
import { ShareCapabilityPanel } from "../../src/app/components/share-capability-panel";
import { SharedReceiverConsole } from "../../src/app/components/shared-receiver-console";
import { ReceiverConsole } from "../../src/app/components/receiver-console";
import { AccountLifecyclePanel } from "../../src/app/components/account-lifecycle-panel";
import { GoogleSignInForm } from "../../src/app/components/google-sign-in-form";
import { HandoffSteps,ItemMeaning } from "../../src/app/components/handoff-presentation";
import PageError from "../../src/app/error";
import Loading from "../../src/app/loading";
import NotFound from "../../src/app/not-found";
import {items,handoffId,publishedAt,handoffs} from "./data";

const pages=[["library","전달함"],["new","새 전달"],["review","검토"],["published","확정·공유"],["shared","수신"],["receiver","내 계정 읽기"],["account","계정"],["login","로그인"],["error","오류"],["loading","대기"],["missing","404"]];
export function Preview({path,query}:{path:string;query:string}){
  useEffect(()=>{document.documentElement.dataset.previewHydrated="true";},[]);
  const state=new URLSearchParams(query).get("state"),page=path.includes("/review")?"review":path.includes("/published")?"published":path==="/share"?"shared":path==="/handoffs"?"library":path.startsWith("/receiver/")?"receiver":path.replace(/^\//,"")||"library";
  return <><div className="preview-banner"><strong>디자인 검토용 · 합성 자료</strong><span>실제 계정·DB·외부 AI와 연결되지 않습니다. 저장·공유·삭제는 모의 처리됩니다.</span></div><main className="app-shell"><header className="app-brand"><span className="brand-symbol" aria-hidden="true">H</span><h1>Hermeneus</h1></header><nav className="preview-nav" aria-label="디자인 검토 화면">{pages.map(([slug,label])=><a key={slug} href={`/${slug}`} aria-current={page===slug?"page":undefined}>{label}</a>)}</nav>
    <div className={!["login","shared","receiver","error","loading","missing"].includes(page)?"workspace-layout":undefined}>{!["login","shared","receiver","error","loading","missing"].includes(page)?<aside className="workspace-sidebar"><CreatorNavLinks activeCreator/></aside>:null}<div className={!["login","shared","receiver","error","loading","missing"].includes(page)?"workspace-content":undefined}>
    {page==="library"?<HandoffLibrary handoffs={state==="empty"?[]:handoffs}/>:null}
    {page==="new"?<NewHandoffWorkspace/>:null}
    {page==="review"?<><header className="page-heading"><h2>보낼 내용 검토</h2><p className="page-lead">빠진 내용은 추가하고, 확정한 것과 미정인 것을 구분해주세요.</p></header><HandoffSteps current={2}/><ReviewEditor handoffId={handoffId} initialRevision={2} initialItems={state==="empty"?[]:items} reviewKind={state==="erased"?"erased":state==="retained"?"retained":"not_collected"} erasedAt={state==="erased"?"2026-10-19T23:30:05.000Z":undefined} sourceConversation={state==="retained"?{messages:[{id:"m1",role:"creator",content:"금요일까지 웹 초안이 필요해요."}]} as any:undefined}/><HandoffLifecyclePanel handoffId={handoffId} sourceKind={state==="retained"?"retained":state==="erased"?"erased":"not_collected"}/></>:null}
    {page==="published"?<><header className="page-heading"><h2>전달본 공유</h2><p className="page-lead">내용이 확정되었습니다. 공유 링크를 만들어 상대에게 보내세요.</p><p className="version-line">버전 1 · 확정 2026. 10. 20.</p></header><HandoffSteps current={3}/><p className="page-links"><a href="/receiver">내 계정으로 전달본 읽기 · 버전 1</a><a href="/review">다음 버전 초안 편집</a></p><div className="publication-layout"><PublishedDocument items={items} version={1} publishedAt={publishedAt} heading="상대에게 전달되는 내용"/><aside className="publication-sharing"><ShareCapabilityPanel handoffId={handoffId} version={1} initialCapabilities={state==="with-links"?[{id:"cap_ux_revoked",handoffId,version:1,createdAt:"2026-10-19T23:30:05.000Z",revokedAt:"2026-10-20T01:02:03.000Z"}]:[]}/></aside></div></>:null}
    {page==="shared"?<><header className="page-heading"><h2>공유받은 전달본</h2></header><SharedReceiverConsole token="synthetic-preview-only" version={1} publishedAt={publishedAt} items={items} semanticModeEnabled={false} externalVerifierEnabled={state==="consent"}/></>:null}
    {page==="receiver"?<ReceiverConsole handoffId={handoffId} version={1} publishedAt={publishedAt} items={items} semanticModeEnabled={false}/>:null}
    {page==="account"?<><header className="page-heading"><h2>계정·데이터</h2><p className="page-lead">계정과 전달 데이터의 삭제 범위를 확인하고 관리하세요.</p></header><AccountLifecyclePanel lifecycleStatus={state==="erasing"?"erasing":"active"}/></>:null}
    {page==="login"?<section className="panel login-panel"><h2>Hermeneus에 로그인</h2><p>전달할 내용을 정리하고 공유 링크를 만들 수 있습니다.</p><GoogleSignInForm/></section>:null}
    {page==="error"?<PageError error={Error("fixture")} reset={()=>window.location.reload()}/>:null}{page==="loading"?<Loading/>:null}{page==="missing"?<NotFound/>:null}
  </div></div></main></>;
}
