import { ImportForm } from "./import-form";
import { BootstrapForm } from "./bootstrap-form";
import { SenderPromptGuide } from "./sender-prompt-guide";
import { HandoffSteps } from "./handoff-presentation";

export function NewHandoffWorkspace() {
  return <>
    <header className="page-heading"><h2>새 전달 만들기</h2><p className="page-lead">사용하던 AI에서 초안을 가져온 뒤, 보낼 내용을 직접 확인합니다.</p></header>
    <HandoffSteps current={1}/>
    <div className="creation-layout">
      <div className="creation-main">
        <section className="panel creation-proposal creation-step" aria-labelledby="prepare-heading"><span className="step-marker" aria-hidden="true">01</span><div><h2 id="prepare-heading">내 AI에 안내문 보내기</h2><p className="field-help">전달할 일을 이야기하던 AI 대화에 붙여넣으세요. AI가 초안을 JSON 형식으로 만들어 줍니다.</p><SenderPromptGuide/></div></section>
        <section className="panel creation-proposal creation-step" aria-labelledby="bring-heading"><span className="step-marker" aria-hidden="true">02</span><div><h2 id="bring-heading">AI가 만든 초안 가져오기</h2><BootstrapForm/></div></section>
      </div>
      <aside className="creation-aside"><section className="journey-note"><h2>초안에 담을 내용</h2><ul><li>상대에게 무엇을 부탁하는지</li><li>어떤 배경과 조건이 있는지</li><li>확정한 것과 아직 미정인 것</li></ul></section><details className="creation-import"><summary>대화 원문에서 시작하기</summary><p className="field-help">이 경로는 대화 원문을 Hermeneus에 저장합니다. 각 줄을 <code>creator:</code>, <code>assistant:</code>, <code>other:</code>로 시작하세요.</p><ImportForm/></details></aside>
    </div>
  </>;
}
