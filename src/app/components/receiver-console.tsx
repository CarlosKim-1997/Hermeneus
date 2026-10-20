"use client";

import { useState, type FormEvent } from "react";
import type { HandoffItemType, HandoffPriority } from "../../handoff/schema.js";
import type { ProvenanceBundle } from "../../persistence/receiver-types.js";
import type { Answerability } from "../../receiver/interpret.js";
import { ItemMeaning } from "./handoff-presentation";
import { PublishedDocument } from "./published-document";
import {
  askReceiverQuestionAction,
  fetchReceiverProvenanceAction,
} from "../../application/receiver-actions.js";

type ReceiverItemView = {
  id: string;
  type: HandoffItemType;
  statement: string;
  priority: HandoffPriority;
};

type Props = {
  handoffId: string;
  version: number;
  publishedAt: string;
  items: ReceiverItemView[];
  semanticModeEnabled: boolean;
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

export function ReceiverConsole({ handoffId, version, publishedAt, items, semanticModeEnabled }: Props) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [provenanceByItem, setProvenanceByItem] = useState<Record<string, ProvenanceBundle["items"][number]>>({});
  const [provenancePending, setProvenancePending] = useState<string | null>(null);

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setAnswer(null);
    setProvenanceByItem({});
    try {
    const result = await askReceiverQuestionAction({ handoffId, version, question });
    if (!result.ok) {
      setError(result.error.message);
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
    try {
    const result = await fetchReceiverProvenanceAction({ handoffId, version, itemIds: [itemId] });
    if (!result.ok) {
      setError(result.error.message);
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
      <p className="receiver-notice">
        {semanticModeEnabled
          ? "이 화면의 질문은 현재 버전의 전달본을 기준으로 AI가 해석합니다."
          : "이 화면은 정해진 규칙으로 질문을 해석합니다. 자유로운 자연어 설명 기능은 켜져 있지 않습니다."}
      </p>

      <p className="receiver-pin">버전 {version}을 읽고 있습니다. 이후 새 버전이 만들어져도 이 화면은 자동으로 바뀌지 않습니다.</p>
      <PublishedDocument items={items} version={version} publishedAt={publishedAt} heading="내 계정으로 읽는 확정 전달본"/>

      <section className="panel panel-receiver-qa">
        <h3>이 전달본에서 질문하기</h3>
        <form onSubmit={onAsk}>
          <label htmlFor="receiver-question">궁금한 점</label>
          <textarea
            id="receiver-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="예: 웹 화면부터 준비하기로 확정됐나요?"
            rows={3}
          />
          <div className="actions">
            <button type="submit" className="primary" disabled={pending || !question.trim()}>
              {pending ? "답변 확인 중…" : "질문하기"}
            </button>
          </div>
        </form>

        {error ? <p className="error" role="alert">{error}</p> : null}

        {answer ? (
          <div className="receiver-answer">
            <p className={`answerability answerability-${answer.classification.toLowerCase()}`}>
              <span className="answerability-label">{answer.classification}</span>
              <span className="answerability-help">{CLASSIFICATION_HELP[answer.classification]}</span>
            </p>
            <p>{answer.answer}</p>
            {answer.interpretationNotice ? <p className="notice">{answer.interpretationNotice}</p> : null}
            {answer.answerNotice ? <p className="notice">{answer.answerNotice}</p> : null}
            {answer.citedItems.length > 0 ? (
              <div className="receiver-citations">
                <h4>전달본의 근거</h4>
                {answer.citedItems.map((item) => (
                  <article key={item.id} className="item-card citation-card">
                    <ItemMeaning type={item.type} priority={item.priority} />
                    <p>{item.statement}</p>
                    <div className="actions">
                      <button type="button" onClick={() => onShowProvenance(item.id)} disabled={provenancePending === item.id}>
                        {provenancePending === item.id ? "불러오는 중…" : "원문 근거 보기"}
                      </button>
                    </div>
                    {provenanceByItem[item.id] ? (
                      <ul className="provenance-list">
                        {provenanceByItem[item.id].references.map((reference) => (
                          <li key={`${item.id}-${reference.messageId}`}>
                            <span className="message-role">{reference.role}</span>
                            {reference.excerptAvailable && reference.excerpt ? (
                              <p>{reference.excerpt}</p>
                            ) : (
                              <p className="provenance-missing">
                                원문 참조는 있지만 이 화면에 공개할 수 있는 인용은 없습니다.
                              </p>
                            )}
                            <p className="provenance-meta">메시지 {reference.messageId}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
