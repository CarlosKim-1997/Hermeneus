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
  const state=new URLSearchParams(query).get("state"),page=path.includes("/review")?"review":path.includes("/published")?"published":path==="/share"?"shared":path==="/handoffs"?"library":path.startsWith("/receiver/")?"receiver":path.replace(/^\//,"")||"library";
  return <><div className="preview-banner"><strong>디자인 검토용 · 합성 자료</strong><span>실제 계정·DB·외부 AI와 연결되지 않습니다. 저장·공유·삭제는 모의 처리됩니다.</span></div><main className="app-shell"><header className="app-brand"><span className="brand-symbol" aria-hidden="true">H</span><h1>Hermeneus</h1><span className="brand-caption">생각은 분명하게. 맥락은 이어지게.</span></header><nav className="preview-nav" aria-label="디자인 검토 화면">{pages.map(([slug,label])=><a key={slug} href={`/${slug}`} aria-current={page===slug?"page":undefined}>{label}</a>)}</nav>
    <div className={!["login","shared","receiver","error","loading","missing"].includes(page)?"workspace-layout":undefined}>{!["login","shared","receiver","error","loading","missing"].includes(page)?<aside className="workspace-sidebar"><p className="workspace-label">내 작업 공간</p><CreatorNavLinks activeCreator/><div className="sidebar-note"><span aria-hidden="true">↗</span><p>맥락을 정리하고,<br/>설명은 각자의 AI에서.</p></div></aside>:null}<div className={!["login","shared","receiver","error","loading","missing"].includes(page)?"workspace-content":undefined}>
    {page==="library"?<HandoffLibrary handoffs={state==="empty"?[]:handoffs}/>:null}
    {page==="new"?<NewHandoffWorkspace/>:null}
    {page==="review"?<><header className="page-heading"><p className="eyebrow">전달 내용 검토</p><h2>내 뜻대로 전달될지 확인하세요.</h2><p className="page-lead">요청과 배경이 충분한지, 확정한 내용과 미정인 내용이 구분되는지 검토하세요.</p></header><HandoffSteps current={2}/><ReviewEditor handoffId={handoffId} initialRevision={2} initialItems={state==="empty"?[]:items} reviewKind={state==="erased"?"erased":state==="retained"?"retained":"not_collected"} sourceConversation={state==="retained"?{messages:[{id:"m1",role:"creator",content:"금요일까지 웹 초안이 필요해요."}]} as any:undefined}/><HandoffLifecyclePanel handoffId={handoffId} sourceKind={state==="retained"?"retained":state==="erased"?"erased":"not_collected"}/></>:null}
    {page==="published"?<><header className="page-heading"><p className="eyebrow">전달본 확정·공유</p><h2>이제 맥락을 건네세요.</h2><p className="page-lead">전달 내용이 확정되었습니다. 이 버전의 링크를 만들어 원하는 상대에게 보내세요.</p><p className="version-line">버전 1 · 확정 2026. 10. 20.</p></header><HandoffSteps current={3}/><p className="page-links"><a href="/receiver">내 계정으로 전달본 읽기 · 버전 1</a><a href="/review">다음 버전 초안 편집</a></p><div className="publication-layout"><PublishedDocument items={items} version={1} publishedAt={publishedAt} heading="상대에게 전달되는 내용"/><aside className="publication-sharing"><ShareCapabilityPanel handoffId={handoffId} version={1} initialCapabilities={[]}/></aside></div></>:null}
    {page==="shared"?<><header className="page-heading"><p className="eyebrow">공유받은 전달</p><h2>전달할 맥락이 도착했어요.</h2></header><SharedReceiverConsole token="synthetic-preview-only" version={1} publishedAt={publishedAt} items={items} semanticModeEnabled={false} externalVerifierEnabled={state==="consent"}/></>:null}
    {page==="receiver"?<ReceiverConsole handoffId={handoffId} version={1} publishedAt={publishedAt} items={items} semanticModeEnabled={false}/>:null}
    {page==="account"?<><header className="page-heading"><p className="eyebrow">내 작업 공간 / 계정·데이터</p><h2>계정·데이터</h2><p className="page-lead">계정과 전달 데이터의 삭제 범위를 확인하고 관리하세요.</p></header><AccountLifecyclePanel lifecycleStatus={state==="erasing"?"erasing":"active"}/></>:null}
    {page==="login"?<section className="panel login-panel"><p className="eyebrow">맥락을 이어주는 전달</p><h2>설명을 반복하는 일을 줄여보세요.</h2><p className="login-intro">내 AI와 정리하고, 내가 확인한 의미를 전하세요.</p><p>Google로 로그인하면 전달 초안을 만들고, 검토한 전달본을 링크로 공유할 수 있습니다.</p><GoogleSignInForm/></section>:null}
    {page==="error"?<PageError error={Error("fixture")} reset={()=>window.location.reload()}/>:null}{page==="loading"?<Loading/>:null}{page==="missing"?<NotFound/>:null}
  </div></div></main></>;
}
