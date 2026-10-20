"use client";

import { useState } from "react";
import { SENDER_BOOTSTRAP_PROMPT } from "../../portable/sender-prompt";

export function SenderPromptGuide() {
  const [copyMessage, setCopyMessage] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(SENDER_BOOTSTRAP_PROMPT);
      setCopyMessage("안내문을 복사했습니다. 생각을 정리하던 내 AI 대화에 붙여넣으세요.");
    } catch {
      setShowPrompt(true);
      setCopyMessage("자동 복사를 사용할 수 없습니다. 펼쳐진 안내문을 직접 선택해 복사하세요.");
    }
  }

  return (
    <section aria-labelledby="sender-guide-heading">
      <h3 className="sr-only" id="sender-guide-heading">내 AI에 줄 안내문</h3>
      <div className="actions">
        <button className="primary" type="button" onClick={copyPrompt}>AI에 줄 안내문 복사</button>
        <button type="button" aria-expanded={showPrompt} aria-controls="sender-prompt-content" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? "안내문 접기" : "안내문 직접 보기"}</button>
      </div>
      {copyMessage ? <p className="inline-feedback" role="status">{copyMessage}</p> : null}
      <p className="prompt-next">복사 → 내 AI 대화에 붙여넣기 → AI가 만든 JSON 가져오기</p>
      <p className="field-help">AI는 해당 대화에 있는 맥락만 사용할 수 있습니다. AI의 제안은 아직 승인된 전달본이 아닙니다. 이 경로에서는 대화 원문을 Hermeneus에 수집하지 않습니다.</p>
      <div id="sender-prompt-content" hidden={!showPrompt}>
        <label htmlFor="sender-prompt-text">AI에 줄 안내문</label>
        <textarea id="sender-prompt-text" readOnly rows={12} value={SENDER_BOOTSTRAP_PROMPT} />
      </div>
    </section>
  );
}
