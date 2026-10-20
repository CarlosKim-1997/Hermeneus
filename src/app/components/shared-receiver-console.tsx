"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { HandoffItemType, HandoffPriority } from "../../handoff/schema.js";
import type { SharedProvenanceBundle } from "../../persistence/share-types.js";
import type { Answerability } from "../../receiver/interpret.js";
import {
  askSharedReceiverQuestionAction,
  fetchSharedReceiverProvenanceAction,
  loadSharedReceiverPacketAction,
  verifyExternalAnswerAction,
} from "../../application/share-actions.js";
import type { ReceiverPacket } from "../../portable/receiver-packet.js";
import type { ReceiverVerdict } from "../../receiver/external/verifier.js";
import { ITEM_LABELS, VERDICT_LABELS } from "./handoff-presentation";
import { PublishedDocument } from "./published-document";

type ReceiverItemView = {
  id: string;
  type: HandoffItemType;
  statement: string;
  priority: HandoffPriority;
};

type Props = {
  token: string;
  version: number;
  publishedAt: string;
  items: ReceiverItemView[];
  semanticModeEnabled: boolean;
  externalVerifierEnabled: boolean;
};

type AnswerState = {
  classification: Answerability;
  answer: string;
  citedItems: ReceiverItemView[];
  interpretationNotice?: string;
  answerNotice?: string;
};

const CLASSIFICATION_HELP: Record<Answerability, string> = {
  SUPPORTED: "보낸 사람이 확정한 내용에 직접 근거합니다.",
  DERIVED: "확정된 내용만으로 좁게 도출되는 설명입니다.",
  OPEN: "보낸 사람이 아직 정하지 않은 사항입니다.",
  UNKNOWN: "이 전달본만으로는 알 수 없습니다.",
};

function receiverError(message: string) {
  return message === "This share link is unavailable."
    ? "이 공유 링크를 열 수 없습니다. 보낸 사람에게 새 링크를 요청해주세요."
    : message;
}

function focusReceiverSection(section: HTMLElement | null) {
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({ block: "start" });
}

export function SharedReceiverConsole({ token, version, publishedAt, items, semanticModeEnabled, externalVerifierEnabled }: Props) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState<"packet" | "verification" | "question">("question");
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [provenanceByItem, setProvenanceByItem] = useState<Record<string, SharedProvenanceBundle["items"][number]>>({});
  const [provenancePending, setProvenancePending] = useState<string | null>(null);
  const [packet, setPacket] = useState<ReceiverPacket | null>(null);
  const [externalDisclosure, setExternalDisclosure] = useState(false);
  const [packetPending, setPacketPending] = useState(false);
  const [externalAnswer, setExternalAnswer] = useState("");
  const [externalQuestion, setExternalQuestion] = useState("");
  const [verdict, setVerdict] = useState<ReceiverVerdict | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const [externalVerificationConsent, setExternalVerificationConsent] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyPending, setCopyPending] = useState(false);
  const copyGeneration = useRef(0);
  const verificationGeneration = useRef(0);
  const myAiPathRef = useRef<HTMLElement>(null);
  const onsiteQuestionsRef = useRef<HTMLElement>(null);
  const verificationRef = useRef<HTMLElement>(null);
  useEffect(() => () => { copyGeneration.current += 1; verificationGeneration.current += 1; }, []);

  async function verifyPastedAnswer() {
    if (!packet || !externalAnswer.trim() || verificationPending || (externalVerifierEnabled && !externalVerificationConsent)) return;
    const generation = ++verificationGeneration.current;
    setVerificationPending(true);
    setVerdict(null);
    setError(null);
    setErrorContext("verification");
    try {
      const outcome = await verifyExternalAnswerAction({ token, externalProcessingConsent: externalVerificationConsent, submission: {
        protocol: "hermeneus.receiver-submission/v0", publicationRef: packet.publicationRef,
        packetDigest: packet.canonicalDigest, answerText: externalAnswer,
        ...(externalQuestion ? { question: externalQuestion } : {}),
      } });
      if (generation !== verificationGeneration.current) return;
      if (!outcome.ok) { setError(receiverError(outcome.error)); return; }
      setVerdict(outcome.result);
    } catch {
      if (generation !== verificationGeneration.current) return;
      setError("지금은 검사할 수 없습니다. 결과가 확인되지 않았습니다.");
    } finally {
      setExternalVerificationConsent(false);
      setVerificationPending(false);
    }
  }

  async function preparePacket() {
    if (!externalDisclosure || packetPending) return;
    copyGeneration.current += 1;
    const generation = copyGeneration.current;
    setPacketPending(true);
    setExternalVerificationConsent(false);
    setError(null);
    setErrorContext("packet");
    setCopyMessage("");
    try {
      const result = await loadSharedReceiverPacketAction(token);
      if (generation !== copyGeneration.current) return;
      if (!result.ok) { setError(receiverError(result.error.message)); setPacket(null); return; }
      setPacket(result.packet);
    } catch {
      if (generation !== copyGeneration.current) return;
      setError("설명 자료를 가져올 수 없습니다. 보낸 사람에게 링크를 확인해주세요.");
      setPacket(null);
    } finally {
      setPacketPending(false);
    }
  }

  async function copyPacket() {
    if (!packet || !externalDisclosure || copyPending) return;
    setCopyPending(true);
    setCopyMessage("");
    setError(null);
    setErrorContext("packet");
    const generation = copyGeneration.current;
    // Recheck the capability before copying a prepared packet.
    try {
      const result = await loadSharedReceiverPacketAction(token);
      if (generation !== copyGeneration.current) return;
      if (!result.ok || result.packet.canonicalDigest !== packet.canonicalDigest) {
        setPacket(null);
        setError("설명 자료를 가져올 수 없습니다. 보낸 사람에게 링크를 확인해주세요.");
        return;
      }
      try {
        await navigator.clipboard.writeText(JSON.stringify(result.packet, null, 2));
        if (generation !== copyGeneration.current) return;
        setCopyMessage("설명 자료를 복사했습니다. 내 AI의 새 대화에 붙여넣고 궁금한 점을 물어보세요.");
      } catch {
        if (generation !== copyGeneration.current) return;
        setCopyMessage("자동 복사가 되지 않았습니다. 아래 설명 자료를 직접 선택해 복사하세요.");
      }
    } catch {
      if (generation !== copyGeneration.current) return;
      setPacket(null);
      setError("설명 자료를 가져올 수 없습니다. 공유 링크를 확인한 뒤 다시 준비하세요.");
    } finally {
      setCopyPending(false);
    }
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setErrorContext("question");
    setAnswer(null);
    setProvenanceByItem({});
    try {
    const result = await askSharedReceiverQuestionAction({ token, question });
    if (!result.ok) {
      setError(receiverError(result.error.message));
      return;
    }
    setAnswer({
      classification: result.answer.classification,
      answer: result.answer.answer,
      citedItems: result.answer.citedItems,
      interpretationNotice: result.answer.interpretationNotice,
      answerNotice: result.answer.answerNotice,
    });
    } catch { setError("질문을 처리하지 못했습니다. 입력한 내용을 확인하고 다시 시도하세요."); }
    finally { setPending(false); }
  }

  async function onShowProvenance(itemId: string) {
    setProvenancePending(itemId);
    setError(null);
    setErrorContext("question");
    try {
    const result = await fetchSharedReceiverProvenanceAction({ token, itemIds: [itemId] });
    if (!result.ok) {
      setError(receiverError(result.error.message));
      return;
    }
    const entry = result.provenance.items.find((item) => item.itemId === itemId);
    if (entry) {
      setProvenanceByItem((current) => ({ ...current, [itemId]: entry }));
    }
    } catch { setError("원문 근거를 불러오지 못했습니다. 다시 시도할 수 있습니다."); }
    finally { setProvenancePending(null); }
  }

  return (
    <div className="receiver-layout">
      <p className="receiver-notice receiver-reading-intro">먼저 전달본을 읽어보세요. 더 필요한 설명은 내가 쓰는 AI와 이어갈 수 있습니다.</p>
      <p className="receiver-pin">이 링크는 항상 버전 {version}을 엽니다. 이후 새 버전으로 자동 변경되지 않습니다.</p>

      <PublishedDocument items={items} version={version} publishedAt={publishedAt}/>

      <nav className="receiver-route-choice" aria-label="전달 내용을 더 알아보는 방법">
        <div>
          <span className="route-symbol" aria-hidden="true">↗</span><p className="eyebrow">내용을 읽은 다음</p>
          <h2>내 맥락으로<br />더 알아보기</h2>
          <button className="primary" type="button" onClick={() => focusReceiverSection(myAiPathRef.current)}>내 AI로 설명받기</button>
          <p>전달본과 안내문을 내 AI의 새 대화에 가져가 설명받으세요.</p>
          <p className="field-help">현재는 자료를 복사해 옮깁니다. ChatGPT 자동 연결은 이 화면에 아직 통합되지 않았습니다.</p>
          <button className="route-check" type="button" onClick={() => focusReceiverSection(verificationRef.current)}>가져온 답변 검사로 이동 <span aria-hidden="true">↓</span></button>
        </div>
        <div>
          <p className="eyebrow">보조 경로</p>
          <button type="button" onClick={() => focusReceiverSection(onsiteQuestionsRef.current)}>이 화면에서 질문하기</button>
          <p>다른 AI로 옮기지 않고 이 화면의 제한된 질문 기능을 사용합니다.</p>
        </div>
      </nav>

      <section id="use-my-ai" ref={myAiPathRef} tabIndex={-1} className="receiver-ai-path" aria-labelledby="my-ai-heading">
        <header>
          <p className="eyebrow">내 AI로 맥락 따라가기</p>
          <h2 id="my-ai-heading">내 AI로 설명받기</h2>
          <p>설명 자료를 내 AI로 가져가 대화한 뒤, 확인하고 싶은 답변 원문만 이곳에 붙여넣으세요.</p>
        </header>
      <section className="panel panel-transfer">
        <p className="eyebrow">01 / 내 AI에 설명 자료 전달</p>
        <h3>내 AI에 가져갈 자료 준비</h3>
        <p>전달본에 민감한 정보가 포함될 수 있습니다. 복사한 내용을 외부 AI에 붙여넣으면 해당 서비스의 처리 조건이 적용됩니다. 이 링크를 해제해도 외부에 만든 사본은 지워지지 않습니다.</p>
        <label><input type="checkbox" checked={externalDisclosure} onChange={(event) => { copyGeneration.current += 1; verificationGeneration.current += 1; setExternalDisclosure(event.target.checked); setPacket(null); setVerdict(null); setExternalVerificationConsent(false); setCopyMessage(""); }} /> 전달본을 외부 AI로 옮길 때의 공개 범위를 이해했습니다.</label>
        <div className="actions"><button type="button" disabled={!externalDisclosure || packetPending} onClick={preparePacket}>{packetPending ? "자료 준비 중…" : "설명 자료 준비"}</button></div>
        {!externalDisclosure ? <p className="field-help">위 내용을 확인하고 체크하면 설명 자료를 준비할 수 있습니다.</p> : null}
        {error && errorContext === "packet" ? <p className="form-error" role="alert">{error}</p> : null}
        {packet ? <>
          <p>기준 버전 {packet.version} · 연결 식별값 {packet.canonicalDigest}</p>
          <p>내 AI의 새 대화에 자료를 붙여넣으세요. 확정 사항·미정 사항·외부 지식을 구분해 설명하도록 요청하세요. AI의 인용 표시는 검증의 증거가 아닙니다.</p>
          <button type="button" disabled={copyPending} onClick={copyPacket}>{copyPending ? "복사 중…" : "내 AI용 자료 복사"}</button>
          {copyMessage ? <p className="inline-feedback" role="status">{copyMessage}</p> : null}
          <label htmlFor="receiver-packet-text">직접 복사할 설명 자료</label>
          <textarea id="receiver-packet-text" readOnly value={JSON.stringify(packet, null, 2)} />
        </> : null}
      </section>

      <section ref={verificationRef} tabIndex={-1} className="panel panel-verification" aria-labelledby="verification-heading">
        <p className="eyebrow">02 / 선택한 답변만 검사</p>
        <h3 id="verification-heading">AI의 설명이 전달본과 맞는지 확인</h3>
        {!externalVerifierEnabled ? (
          <div className="receiver-notice" id="verification-availability">
            <strong>현재 의미 검증이 꺼져 있습니다.</strong>
            <p>답변을 보내도 결과는 INDETERMINATE(판정할 수 없음)입니다. 이 환경에서는 전달본과 의미가 일치하는지 검사하지 않습니다.</p>
          </div>
        ) : null}
        <p>의미 검증이 켜진 경우, 제출한 답변만 이 버전의 전달본과 비교합니다. AI와 나눈 전체 대화나 사람의 이해 여부를 검사하지 않습니다.</p>
        <p>Hermeneus에 전달해도 괜찮은 답변만 붙여넣으세요. 개인적인 맥락이 포함되어 있는지 먼저 확인하세요.</p>
        <label htmlFor="external-question">그때 물어본 질문 · 선택 사항</label>
        <textarea id="external-question" value={externalQuestion} placeholder="예: 모바일 화면도 이번 요청에 포함되나요?" onChange={(event) => { verificationGeneration.current += 1; setExternalQuestion(event.target.value); setExternalVerificationConsent(false); setVerdict(null); }} />
        <label htmlFor="external-answer">확인할 AI 답변 원문</label>
        <textarea id="external-answer" aria-describedby={!externalVerifierEnabled ? "verification-availability" : undefined} value={externalAnswer} placeholder="대화 전체 대신, 확인하고 싶은 답변의 원문만 붙여넣으세요." onChange={(event) => { verificationGeneration.current += 1; setExternalAnswer(event.target.value); setExternalVerificationConsent(false); setVerdict(null); }} />
        {externalVerifierEnabled ? <label>
          <input type="checkbox" checked={externalVerificationConsent} onChange={(event) => setExternalVerificationConsent(event.target.checked)} />
          이번 검사에 한해 현재 버전의 전달 내용·질문·답변을 OpenAI로 보내는 데 동의합니다. OpenAI의 기본 API 오용 모니터링 로그에는 제한적인 예외를 제외하고 최대 30일간 내용이 포함될 수 있습니다. Hermeneus는 답변이나 동의 선택을 영속 저장하지 않습니다.
        </label> : null}
        <button type="button" disabled={!packet || !externalAnswer.trim() || verificationPending || (externalVerifierEnabled && !externalVerificationConsent)} onClick={verifyPastedAnswer}>{verificationPending ? "검사 중…" : "이 답변 검사"}</button>
        {!packet ? <p className="field-help">먼저 위에서 설명 자료를 준비하세요. 같은 버전에 연결된 답변만 검사합니다.</p>
          : !externalAnswer.trim() ? <p className="field-help">확인하고 싶은 답변의 원문을 붙여넣으세요.</p>
          : externalVerifierEnabled && !externalVerificationConsent ? <p className="field-help">이번 검사에 대한 외부 전송 동의를 체크해주세요.</p> : null}
        {error && errorContext === "verification" ? <p className="form-error" role="alert">{error}</p> : null}
        {verdict ? <div className={`verification-result verification-${verdict.verdict.toLowerCase()}`} role="status"><p className="eyebrow">이 답변과 버전 {version}의 비교 결과</p><strong>{VERDICT_LABELS[verdict.verdict]}</strong> <code>{verdict.verdict}</code><p>이 결과는 아래 원문에만 적용됩니다. 대화 전체나 사람의 이해 여부를 보증하지 않습니다.</p><pre className="checked-answer">{externalAnswer}</pre><p>{verdict.issues.join(" ")}</p><p>{verdict.limitations.join(" ")}</p></div> : null}
      </section>
      </section>

      <section id="ask-here" ref={onsiteQuestionsRef} tabIndex={-1} className="panel panel-receiver-qa" aria-labelledby="ask-here-heading">
        <p className="eyebrow">보조 경로 / 이 화면의 질문</p>
        <h2 id="ask-here-heading">이 화면에서 질문하기</h2>
        <p>이 전달본에 직접 질문합니다. 내 AI가 만든 답변을 검사하는 기능과는 별개입니다.</p>
        <p className="field-help">{semanticModeEnabled ? "현재 설정된 AI 해석 기능으로 질문을 처리합니다." : "이 환경에서는 정해진 규칙으로 질문을 해석합니다. 자유로운 대화형 설명은 제공하지 않습니다."}</p>
        <form onSubmit={onAsk}>
          <label htmlFor="shared-receiver-question">궁금한 점</label>
          <textarea
            id="shared-receiver-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
          />
          <button type="submit" disabled={pending}>
            {pending ? "답변 확인 중…" : "질문하기"}
          </button>
        </form>
        {error && errorContext === "question" ? <p className="form-error" role="alert">{error}</p> : null}
        {answer ? (
          <div className="receiver-answer">
            <p className="answerability-label">{answer.classification}</p>
            <p className="answerability-help">{CLASSIFICATION_HELP[answer.classification]}</p>
            {answer.interpretationNotice ? <p className="receiver-notice">{answer.interpretationNotice}</p> : null}
            {answer.answerNotice ? <p className="receiver-notice">{answer.answerNotice}</p> : null}
            <p>{answer.answer}</p>
            {answer.citedItems.length ? (
              <ul>
                {answer.citedItems.map((item) => (
                  <li key={item.id}>
                    <strong>{ITEM_LABELS[item.type]}</strong>: {item.statement}
                    <div>
                      <button type="button" onClick={() => onShowProvenance(item.id)} disabled={provenancePending === item.id}>
                        {provenancePending === item.id ? "불러오는 중…" : "원문 근거 보기"}
                      </button>
                    </div>
                    {provenanceByItem[item.id] ? (
                      <ul>
                        {provenanceByItem[item.id].references.map((reference, referenceIndex) => (
                          <li key={`${item.id}-ref-${referenceIndex}`}>
                            {reference.excerptAvailable && reference.excerpt
                              ? `"${reference.excerpt}"`
                              : "이 화면에 공개가 승인된 원문 인용이 없습니다."}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
