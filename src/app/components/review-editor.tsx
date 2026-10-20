"use client";

import { useMemo, useState, useTransition } from "react";
import type { HandoffItem, HandoffItemType, HandoffPriority } from "../../handoff/schema.js";
import type { NormalizedConversation } from "../../import/types.js";
import { ITEM_LABELS, PRIORITY_LABELS } from "./handoff-presentation";
import {
  generateExtractionSuggestionsAction,
  publishHandoffAction,
  saveDraftAction,
} from "../../application/actions";

const TYPES: HandoffItemType[] = [
  "CORE_INTENT",
  "CONTEXT",
  "CONFIRMED",
  "TENTATIVE",
  "OPEN",
  "REJECTED",
  "CONSTRAINT",
  "RATIONALE",
];

const PRIORITIES: HandoffPriority[] = ["CORE", "IMPORTANT", "SUPPORTING"];

type Props = {
  handoffId: string;
  initialRevision: number;
  initialItems: HandoffItem[];
  reviewKind: "retained" | "erased" | "not_collected";
  sourceConversation?: NormalizedConversation;
  erasedAt?: string;
};

function newItemId() {
  return `item_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function ReviewEditor({
  handoffId,
  initialRevision,
  initialItems,
  reviewKind,
  sourceConversation,
  erasedAt,
}: Props) {
  const sourceErased = reviewKind === "erased";
  const sourceRetained = reviewKind === "retained";
  const [revision, setRevision] = useState(initialRevision);
  const [items, setItems] = useState<HandoffItem[]>(initialItems);
  const [savedItems, setSavedItems] = useState(() => JSON.stringify(initialItems));
  const hasUnsavedChanges = JSON.stringify(items) !== savedItems;
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [suggestions, setSuggestions] = useState<HandoffItem[]>([]);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const messageOptions = useMemo(
    () =>
      sourceConversation?.messages.map((message) => ({
        id: message.id,
        label: `${message.role}: ${message.content.slice(0, 80)}`,
      })) ?? [],
    [sourceConversation],
  );

  function updateItem(index: number, patch: Partial<HandoffItem>) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (item.createdBy === "EXTRACTION" && Object.keys(patch).length > 0) {
          return { ...next, createdBy: "CREATOR" };
        }
        return next;
      }),
    );
  }

  function generateSuggestions() {
    setExtractionMessage(null);
    setExtractionError(null);
    startTransition(async () => {
      const result = await generateExtractionSuggestionsAction(handoffId);
      if (!result.ok) {
        setExtractionError(result.error.message);
        return;
      }
      setSuggestions(result.suggestions);
      setExtractionMessage(
        `AI 제안 ${result.suggestions.length}개를 받았습니다. 초안에 추가하고 저장하기 전에는 보관되지 않습니다.`,
      );
    });
  }

  function dismissSuggestion(suggestionId: string) {
    setSuggestions((current) => current.filter((entry) => entry.id !== suggestionId));
  }

  function acceptSuggestion(suggestion: HandoffItem) {
    setItems((current) => [...current, suggestion]);
    dismissSuggestion(suggestion.id);
  }

  function acceptAllSuggestions() {
    setItems((current) => [...current, ...suggestions]);
    setSuggestions([]);
    setExtractionMessage("제안을 편집 중인 초안에 추가했습니다. 초안을 저장해야 보관됩니다.");
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        id: newItemId(),
        type: "CONFIRMED",
        statement: "",
        priority: "IMPORTANT",
        createdBy: "CREATOR",
        sources: [],
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function saveDraft() {
    setSaveMessage(null);
    setConflict(false);
    startTransition(async () => {
      const result = await saveDraftAction({ handoffId, expectedRevision: revision, items });
      if (!result.ok) {
        if (result.error.code === "CONFLICT") setConflict(true);
        setSaveMessage(result.error.message);
        return;
      }
      setRevision(result.revision);
      setSavedItems(JSON.stringify(items));
      setSaveMessage(`초안 수정 ${result.revision}을 저장했습니다.`);
    });
  }

  function publishDraft() {
    setPublishError(null);
    startTransition(async () => {
      const save = await saveDraftAction({ handoffId, expectedRevision: revision, items });
      if (!save.ok) {
        if (save.error.code === "CONFLICT") setConflict(true);
        setPublishError(save.error.message);
        return;
      }
      const approvedRevision = save.revision;
      setRevision(approvedRevision);
      setSavedItems(JSON.stringify(items));
      const published = await publishHandoffAction(handoffId, approvedRevision);
      if (published && "error" in published) {
        if (published.error.code === "CONFLICT") setConflict(true);
        setPublishError(published.error.message);
      }
    });
  }

  return (
    <div className={`grid-two review-layout ${sourceRetained ? "review-with-source" : "review-without-source"}`}>
      <details className="panel panel-source" open={sourceRetained}>
        <summary id="source-heading">검토에 쓰인 자료</summary>
        {sourceErased ? (
          <>
            <p className="notice">
              <strong>원문 삭제됨 · 원문 근거 확인 불가</strong>
              {erasedAt ? ` 삭제일 ${new Date(erasedAt).toLocaleString('ko-KR')}.` : null} 원문 연결 없이 전달 초안을 계속 편집할 수 있습니다.
            </p>
          </>
        ) : reviewKind === "not_collected" ? (
          <p className="notice"><strong>대화 원문을 수집하지 않았습니다.</strong> 내 AI에서 가져온 제안으로 만든 초안입니다. 원래 대화와 원문 인용은 없으므로 내용을 직접 확인하세요.</p>
        ) : (
          <>
            <p>검토를 위한 원문입니다. 상대에게 전달되는 내용은 직접 확정한 전달본입니다.</p>
            {sourceConversation?.messages.map((message) => (
              <article key={message.id} className="message">
                <div className="message-role">{message.role}</div>
                <div>{message.content}</div>
              </article>
            ))}
          </>
        )}
      </details>

      <section className="panel panel-draft" aria-labelledby="draft-heading">
        <h2 id="draft-heading">상대에게 전할 내용</h2>
        {sourceRetained ? (
          <div className="extraction-panel">
            <h3>대화에서 AI 제안 받기 · 선택 사항</h3>
            <p className="notice">
              이 기능은 가져온 대화 원문을 설정된 외부 AI 제공자에게 보냅니다. 제안을 초안에 추가하고,
              내용을 검토·저장·확정하기 전에는 상대에게 전달되지 않습니다.
            </p>
            <div className="actions">
              <button type="button" onClick={generateSuggestions} disabled={pending}>
                원문으로 AI 제안 받기
              </button>
              {suggestions.length ? (
                <button type="button" onClick={acceptAllSuggestions} disabled={pending}>
                  모든 제안을 초안에 추가
                </button>
              ) : null}
            </div>
            {extractionMessage ? <p role="status">{extractionMessage}</p> : null}
            {extractionError ? (
              <p className="error" role="alert">
                {extractionError}
              </p>
            ) : null}
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="item-card suggestion-card">
                <p className="suggestion-label">AI 제안 · 아직 저장 전</p>
                <p>
                  <strong>{ITEM_LABELS[suggestion.type]}</strong> — {suggestion.statement}
                </p>
                <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                  원문 근거:{" "}
                  {suggestion.sources.map((source) => `${source.messageId} (“${source.excerpt ?? ""}”)`).join("; ")}
                </p>
                <div className="actions">
                  <button type="button" onClick={() => acceptSuggestion(suggestion)}>
                    초안에 추가
                  </button>
                  <button type="button" className="danger" onClick={() => dismissSuggestion(suggestion.id)}>
                    제안 제외
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="notice">{sourceErased
            ? "원문 근거가 삭제되어 원문에서 AI 제안을 만들 수 없습니다."
            : "대화 원문을 수집하지 않은 경로입니다. 내 AI의 제안을 직접 검토하세요."}</p>
        )}
        <p>
          초안 수정: <strong>{revision}</strong>
        </p>
        <p className={`draft-save-state ${hasUnsavedChanges ? "draft-save-state-dirty" : ""}`} role="status">
          {hasUnsavedChanges ? "저장하지 않은 변경이 있습니다. 초안을 저장하거나 전달본으로 확정하세요." : "저장된 초안을 보고 있습니다."}
        </p>
        {items.length === 0 ? <div className="editor-empty"><h3>전할 내용을 하나씩 담아보세요</h3><p>부탁할 일이나 배경부터 한 항목씩 추가할 수 있습니다.</p><button type="button" onClick={addItem}>첫 항목 추가</button></div> : null}
        {conflict ? (
          <p className="error" role="alert">
            다른 곳에서 초안이 변경되었습니다. 현재 입력을 따로 보관하고 새로고침해 최신 초안을 확인하세요.
          </p>
        ) : null}
        {saveMessage ? <p role="status">{saveMessage}</p> : null}
        {publishError ? <p className="error" role="alert">{publishError}</p> : null}

        {items.map((item, index) => (
          <div key={item.id} className="item-card draft-item">
            <p className="eyebrow">항목 {index + 1}</p>
            <label htmlFor={`statement-${item.id}`}>전달할 내용</label>
            <textarea
              id={`statement-${item.id}`}
              value={item.statement}
              onChange={(event) => updateItem(index, { statement: event.target.value })}
            />
            <label htmlFor={`type-${item.id}`}>내용 분류</label>
            <select
              id={`type-${item.id}`}
              value={item.type}
              onChange={(event) => updateItem(index, { type: event.target.value as HandoffItemType })}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {ITEM_LABELS[type]}
                </option>
              ))}
            </select>
            <label htmlFor={`priority-${item.id}`}>중요도</label>
            <select
              id={`priority-${item.id}`}
              value={item.priority}
              onChange={(event) => updateItem(index, { priority: event.target.value as HandoffPriority })}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>

            {sourceRetained ? (
            <fieldset style={{ marginTop: "0.75rem", border: "1px solid #e5e7eb", borderRadius: 6, padding: "0.75rem" }}>
              <legend>원문 근거</legend>
              {(item.sources.length ? item.sources : [{ messageId: "", excerpt: "" }]).map((source, sourceIndex) => (
                <div key={`${item.id}-${sourceIndex}`} style={{ marginBottom: "0.75rem" }}>
                  <label htmlFor={`message-${item.id}-${sourceIndex}`}>근거가 되는 메시지</label>
                  <select
                    id={`message-${item.id}-${sourceIndex}`}
                    value={source.messageId}
                    onChange={(event) => {
                      const nextSources = [...(item.sources.length ? item.sources : [{ messageId: "", excerpt: "" }])];
                      nextSources[sourceIndex] = { ...nextSources[sourceIndex], messageId: event.target.value };
                      updateItem(index, { sources: nextSources.filter((entry) => entry.messageId) });
                    }}
                  >
                    <option value="">메시지 선택</option>
                    {messageOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <label htmlFor={`excerpt-${item.id}-${sourceIndex}`}>원문 인용 · 선택 사항, 원문과 정확히 일치해야 합니다</label>
                  <input
                    id={`excerpt-${item.id}-${sourceIndex}`}
                    value={source.excerpt ?? ""}
                    onChange={(event) => {
                      const nextSources = [...(item.sources.length ? item.sources : [{ messageId: source.messageId, excerpt: "" }])];
                      nextSources[sourceIndex] = {
                        messageId: nextSources[sourceIndex]?.messageId ?? source.messageId,
                        excerpt: event.target.value || undefined,
                      };
                      updateItem(index, { sources: nextSources.filter((entry) => entry.messageId) });
                    }}
                  />
                </div>
              ))}
            </fieldset>
            ) : (
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                {sourceErased ? "원문이 삭제되어 근거를 확인할 수 없습니다." : "대화 원문을 수집하지 않아 연결된 근거가 없습니다."}
              </p>
            )}

            <div className="actions">
              <button type="button" className="danger" onClick={() => removeItem(index)}>
                항목 삭제
              </button>
            </div>
          </div>
        ))}

        <div className="actions draft-actions">
          <button type="button" onClick={addItem}>
            항목 추가
          </button>
          <button type="button" onClick={saveDraft} disabled={pending}>
            초안 저장
          </button>
          <button type="button" className="primary" onClick={publishDraft} disabled={pending}>
            전달본으로 확정
          </button>
        </div>
        <p style={{ marginTop: "1rem", color: "#64748b" }}>
          확정하면 수정되지 않는 새 버전이 만들어집니다. 이후 변경은 다음 버전으로 확정해야 하며, 대화 원문은 검토 근거로만 사용됩니다.
        </p>
      </section>
    </div>
  );
}
