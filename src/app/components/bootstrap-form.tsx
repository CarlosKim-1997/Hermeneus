"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapHandoffAction } from "../../application/actions.js";
import { parsePortableProposal, PortableProposalError, type PortableProposal } from "../../portable/proposal.js";
import { ITEM_LABELS, PRIORITY_LABELS } from "./handoff-presentation";

function previewErrorMessage(error: unknown): string {
  if (error instanceof PortableProposalError) {
    if (error.code === "JSON_INVALID") {
      return "초안을 읽을 수 없습니다. AI가 만든 코드블록에서 ``` 표시를 뺀 JSON 내용만 복사해 붙여넣으세요.";
    }
    if (error.code === "LIMIT_EXCEEDED") return "초안이 허용 크기를 넘었습니다. 내용을 나누거나 줄인 뒤 다시 가져오세요.";
    if (error.code === "DUPLICATE_KEY" || error.code === "DUPLICATE_PROPOSAL_ID") {
      return "초안에 같은 필드나 항목 번호가 중복되어 있습니다.";
    }
    if (error.code === "PROTOCOL_UNSUPPORTED") return "지원하지 않는 초안 형식입니다. 위의 안내문으로 다시 만들어주세요.";
    return "항목의 번호·분류·중요도·내용 중 잘못된 값이 있습니다. AI에 형식을 다시 확인하도록 요청하세요.";
  }
  return "미리보기를 만들지 못했습니다. 입력한 초안을 따로 보관한 뒤 새로고침해 다시 시도하세요.";
}

export function BootstrapForm() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [proposal, setProposal] = useState<PortableProposal | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saveTitle, setSaveTitle] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewAttempt === 0) return;
    feedbackRef.current?.focus({ preventScroll: true });
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [previewAttempt]);

  function preview() {
    try {
      const parsed = parsePortableProposal(raw);
      const nextRequestKey = crypto.randomUUID();
      setProposal(parsed);
      setRequestKey(nextRequestKey);
      setAcknowledged(false);
      setSaveTitle(false);
      setError("");
    } catch (cause) {
      setProposal(null);
      setError(previewErrorMessage(cause));
    }
    setPreviewAttempt((attempt) => attempt + 1);
  }

  async function create() {
    if (!proposal || !acknowledged || pending) return;
    setPending(true);
    setError("");
    try {
      const result = await bootstrapHandoffAction({
        protocol: proposal.protocol,
        items: proposal.items.map(({ type, priority, statement }) => ({ type, priority, statement })),
        notesAcknowledged: acknowledged,
        saveTitle: saveTitle && !!proposal.title,
        ...(saveTitle && proposal.title ? { title: proposal.title } : {}),
        requestKey,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/handoffs/${result.handoffId}/review`);
    } catch {
      setError("초안을 만들지 못했습니다. 같은 요청을 안전하게 다시 시도할 수 있습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bootstrap-form">
      <label htmlFor="portable-proposal">AI가 만든 전달 초안(JSON)</label>
      <p className="field-help" id="proposal-help">JSON 부분만 붙여넣으세요. 미리보기만으로는 저장되지 않습니다.</p>
      <textarea
        id="portable-proposal"
        aria-describedby="proposal-help"
        value={raw}
        onChange={(event) => { setRaw(event.target.value); setProposal(null); setAcknowledged(false); setSaveTitle(false); setError(""); }}
        placeholder={'{"protocol":"hermeneus.portable-proposal/v0","items":[...]}' }
      />
      <div className="actions"><button type="button" onClick={preview}>초안 미리보기</button></div>
      <div ref={feedbackRef} tabIndex={-1} aria-live="polite">
        {proposal ? (
          <section className="proposal-preview" aria-label="가져온 초안 미리보기">
            <h3>가져온 초안 확인</h3>
            <p>아직 AI의 제안입니다. 다음 단계에서 내용을 편집한 뒤 직접 확정할 수 있습니다.</p>
            <ol>{proposal.items.map((item) => <li key={item.proposalId}><strong>{ITEM_LABELS[item.type]}</strong> · {PRIORITY_LABELS[item.priority]}<p>{item.statement}</p></li>)}</ol>
            {proposal.title ? (
              <label>
                <input type="checkbox" checked={saveTitle} onChange={(event) => setSaveTitle(event.target.checked)} />
                “{proposal.title}”을 내 전달함에서만 쓸 이름으로 저장합니다. 전달본과 공유 내용에는 포함되지 않습니다.
              </label>
            ) : null}
            <h4>AI의 검토 메모</h4>
            {proposal.reviewNotes?.length ? <ul>{proposal.reviewNotes.map((note, index) => <li key={index}>{note}</li>)}</ul> : <p>검토 메모가 없습니다.</p>}
            <p>이 메모는 저장되지 않습니다. 전달할 내용에 포함할 사항은 다음 편집 단계에서 직접 추가하세요.</p>
            <label>
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
              검토 메모를 확인했고, 메모가 저장되지 않는다는 점을 이해했습니다.
            </label>
            <div className="actions"><button className="primary" type="button" disabled={!acknowledged || pending} onClick={create}>{pending ? "초안 만드는 중…" : "초안 만들고 검토하기"}</button></div>
            {!acknowledged ? <p className="field-help">검토 메모를 확인한 뒤 체크해주세요.</p> : null}
          </section>
        ) : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
