"use client";

import { useMemo, useState, useTransition } from "react";
import type { HandoffItem, HandoffItemType, HandoffPriority } from "../../handoff/schema.js";
import type { NormalizedConversation } from "../../import/types.js";
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
  sourceConversation: NormalizedConversation;
};

function newItemId() {
  return `item_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function ReviewEditor({ handoffId, initialRevision, initialItems, sourceConversation }: Props) {
  const [revision, setRevision] = useState(initialRevision);
  const [items, setItems] = useState<HandoffItem[]>(initialItems);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [suggestions, setSuggestions] = useState<HandoffItem[]>([]);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const messageOptions = useMemo(
    () => sourceConversation.messages.map((message) => ({ id: message.id, label: `${message.role}: ${message.content.slice(0, 80)}` })),
    [sourceConversation.messages],
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
        `Received ${result.suggestions.length} AI suggestion(s). They are not saved until you accept them into the draft.`,
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
    setExtractionMessage("All AI suggestions were added to the draft editor. Save draft to persist.");
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
      setSaveMessage(`Saved draft revision ${result.revision}.`);
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
      const published = await publishHandoffAction(handoffId, approvedRevision);
      if (published && "error" in published) {
        if (published.error.code === "CONFLICT") setConflict(true);
        setPublishError(published.error.message);
      }
    });
  }

  return (
    <div className="grid-two">
      <section className="panel panel-source" aria-labelledby="source-heading">
        <h2 id="source-heading">Source Conversation</h2>
        <p>Provenance only. This is not the published Handoff.</p>
        {sourceConversation.messages.map((message) => (
          <article key={message.id} className="message">
            <div className="message-role">{message.role}</div>
            <div>{message.content}</div>
          </article>
        ))}
      </section>

      <section className="panel panel-draft" aria-labelledby="draft-heading">
        <h2 id="draft-heading">Handoff Draft</h2>
        <div className="extraction-panel">
          <h3>AI suggestions (optional)</h3>
          <p className="notice">
            Generate AI suggestions sends the imported conversation to the configured external model provider.
            Suggestions are proposals only — not saved and not published until you accept them, edit the draft, save,
            and explicitly approve publication.
          </p>
          <div className="actions">
            <button type="button" onClick={generateSuggestions} disabled={pending}>
              Generate AI suggestions
            </button>
            {suggestions.length ? (
              <button type="button" onClick={acceptAllSuggestions} disabled={pending}>
                Add all suggestions to draft
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
              <p className="suggestion-label">AI suggestion — not saved</p>
              <p>
                <strong>{suggestion.type}</strong> — {suggestion.statement}
              </p>
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                Provenance:{" "}
                {suggestion.sources.map((source) => `${source.messageId} (“${source.excerpt ?? ""}”)`).join("; ")}
              </p>
              <div className="actions">
                <button type="button" onClick={() => acceptSuggestion(suggestion)}>
                  Add to draft
                </button>
                <button type="button" className="danger" onClick={() => dismissSuggestion(suggestion.id)}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
        <p>
          Draft revision: <strong>{revision}</strong>
        </p>
        {conflict ? (
          <p className="error" role="alert">
            Draft conflict detected. Reload this page before continuing so you do not overwrite a newer draft.
          </p>
        ) : null}
        {saveMessage ? <p role="status">{saveMessage}</p> : null}
        {publishError ? <p className="error" role="alert">{publishError}</p> : null}

        {items.map((item, index) => (
          <div key={item.id} className="item-card">
            <label htmlFor={`statement-${item.id}`}>Statement</label>
            <textarea
              id={`statement-${item.id}`}
              value={item.statement}
              onChange={(event) => updateItem(index, { statement: event.target.value })}
            />
            <label htmlFor={`type-${item.id}`}>Type</label>
            <select
              id={`type-${item.id}`}
              value={item.type}
              onChange={(event) => updateItem(index, { type: event.target.value as HandoffItemType })}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <label htmlFor={`priority-${item.id}`}>Priority</label>
            <select
              id={`priority-${item.id}`}
              value={item.priority}
              onChange={(event) => updateItem(index, { priority: event.target.value as HandoffPriority })}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>

            <fieldset style={{ marginTop: "0.75rem", border: "1px solid #e5e7eb", borderRadius: 6, padding: "0.75rem" }}>
              <legend>Provenance</legend>
              {(item.sources.length ? item.sources : [{ messageId: "", excerpt: "" }]).map((source, sourceIndex) => (
                <div key={`${item.id}-${sourceIndex}`} style={{ marginBottom: "0.75rem" }}>
                  <label htmlFor={`message-${item.id}-${sourceIndex}`}>Source message</label>
                  <select
                    id={`message-${item.id}-${sourceIndex}`}
                    value={source.messageId}
                    onChange={(event) => {
                      const nextSources = [...(item.sources.length ? item.sources : [{ messageId: "", excerpt: "" }])];
                      nextSources[sourceIndex] = { ...nextSources[sourceIndex], messageId: event.target.value };
                      updateItem(index, { sources: nextSources.filter((entry) => entry.messageId) });
                    }}
                  >
                    <option value="">Select message</option>
                    {messageOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <label htmlFor={`excerpt-${item.id}-${sourceIndex}`}>Excerpt (optional, must match source exactly)</label>
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

            <div className="actions">
              <button type="button" className="danger" onClick={() => removeItem(index)}>
                Delete item
              </button>
            </div>
          </div>
        ))}

        <div className="actions">
          <button type="button" onClick={addItem}>
            Add item
          </button>
          <button type="button" onClick={saveDraft} disabled={pending}>
            Save draft
          </button>
          <button type="button" className="primary" onClick={publishDraft} disabled={pending}>
            Approve &amp; Publish
          </button>
        </div>
        <p style={{ marginTop: "1rem", color: "#64748b" }}>
          Approve &amp; Publish creates an immutable version. Later edits require a new version. Source conversation remains provenance, not authority.
        </p>
      </section>
    </div>
  );
}
