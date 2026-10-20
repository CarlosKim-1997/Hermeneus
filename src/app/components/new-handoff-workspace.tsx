import { ImportForm } from "./import-form";
import { BootstrapForm } from "./bootstrap-form";
import { SenderPromptGuide } from "./sender-prompt-guide";
import { HandoffSteps } from "./handoff-presentation";

export function NewHandoffWorkspace() {
  return <>
    <header className="page-heading"><p className="eyebrow">새 전달 만들기</p><h2>생각을 정리한 곳에서,<br />전달은 여기로.</h2><p className="page-lead">내 AI와 나눈 맥락을 가져오세요. 내가 확인한 내용만 상대에게 건넵니다.</p></header>
    <HandoffSteps current={1}/>
    <div className="creation-layout">
      <div className="creation-main">
        <section className="panel creation-proposal creation-step" aria-labelledby="prepare-heading"><span className="step-marker" aria-hidden="true">01</span><div><p className="eyebrow">먼저, 내 AI에서</p><h2 id="prepare-heading">정리하던 대화를 전달 초안으로</h2><p className="field-help">배경을 충분히 나눈 AI 대화에 아래 안내문을 붙여넣으세요.</p><SenderPromptGuide/></div></section>
        <section className="panel creation-proposal creation-step" aria-labelledby="bring-heading"><span className="step-marker" aria-hidden="true">02</span><div><p className="eyebrow">다시, Hermeneus에서</p><h2 id="bring-heading">AI가 만든 초안 가져오기</h2><BootstrapForm/></div></section>
      </div>
      <aside className="creation-aside"><section className="journey-note"><p className="eyebrow">보내기 전 확인할 것</p><h2>이 세 가지가<br />담겨 있나요?</h2><ul><li>상대에게 무엇을 부탁하는지</li><li>어떤 배경과 조건이 있는지</li><li>확정한 것과 아직 미정인 것</li></ul><p className="field-help">가져온 초안은 다음 단계에서 직접 편집하고 확정합니다.</p></section><details className="creation-import"><summary>대화 원문에서 시작하기</summary><p className="field-help">이 경로는 대화 원문을 Hermeneus에 저장합니다. 각 줄을 <code>creator:</code>, <code>assistant:</code>, <code>other:</code>로 시작하세요.</p><ImportForm/></details></aside>
    </div>
  </>;
}
