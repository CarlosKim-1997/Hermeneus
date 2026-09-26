"use client";

import { useState, type FormEvent } from "react";
import type { HandoffItemType, HandoffPriority } from "../../handoff/schema.js";
import type { SharedProvenanceBundle } from "../../persistence/share-types.js";
import type { Answerability } from "../../receiver/interpret.js";
import {
  askSharedReceiverQuestionAction,
  fetchSharedReceiverProvenanceAction,
} from "../../application/share-actions.js";

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
};

type AnswerState = {
  classification: Answerability;
  answer: string;
  citedItems: ReceiverItemView[];
  interpretationNotice?: string;
  answerNotice?: string;
};

const CLASSIFICATION_HELP: Record<Answerability, string> = {
  SUPPORTED: "Directly supported by the approved Handoff.",
  DERIVED: "Follows only from approved items under conservative derivation rules.",
  OPEN: "The Creator explicitly left this unresolved.",
  UNKNOWN: "The approved Handoff does not contain enough information.",
};

export function SharedReceiverConsole({ token, version, publishedAt, items, semanticModeEnabled }: Props) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [provenanceByItem, setProvenanceByItem] = useState<Record<string, SharedProvenanceBundle["items"][number]>>({});
  const [provenancePending, setProvenancePending] = useState<string | null>(null);

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setAnswer(null);
    setProvenanceByItem({});
    const result = await askSharedReceiverQuestionAction({ token, question });
    setPending(false);
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
  }

  async function onShowProvenance(itemId: string) {
    setProvenancePending(itemId);
    setError(null);
    const result = await fetchSharedReceiverProvenanceAction({ token, itemIds: [itemId] });
    setProvenancePending(null);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const entry = result.provenance.items.find((item) => item.itemId === itemId);
    if (entry) {
      setProvenanceByItem((current) => ({ ...current, [itemId]: entry }));
    }
  }

  return (
    <div className="receiver-layout">
      <p className="receiver-notice">
        Shared Receiver view · pinned version {version}.{" "}
        {semanticModeEnabled
          ? "Questions use the same canonical interpretation pipeline as the internal Receiver."
          : "Interpretation is deterministic in this environment."}
      </p>
      <p className="receiver-pin">This link always resolves to version {version} and does not follow newer publications.</p>

      <section className="panel panel-receiver">
        <h2>Published Handoff (shared view)</h2>
        <p>
          Version <strong>{version}</strong> · Published {new Date(publishedAt).toLocaleString()}
        </p>
        {items.map((item) => (
          <article key={item.id} className="item-card">
            <div>
              <strong>{item.type}</strong> · {item.priority}
            </div>
            <p>{item.statement}</p>
          </article>
        ))}
      </section>

      <section className="panel panel-receiver-qa">
        <h3>Ask about this Handoff</h3>
        <form onSubmit={onAsk}>
          <label htmlFor="shared-receiver-question">Your question</label>
          <textarea
            id="shared-receiver-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
          />
          <button type="submit" disabled={pending}>
            {pending ? "Asking…" : "Ask"}
          </button>
        </form>
        {error ? <p className="form-error">{error}</p> : null}
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
                    <strong>{item.type}</strong>: {item.statement}
                    <div>
                      <button type="button" onClick={() => onShowProvenance(item.id)} disabled={provenancePending === item.id}>
                        {provenancePending === item.id ? "Loading…" : "Show source evidence"}
                      </button>
                    </div>
                    {provenanceByItem[item.id] ? (
                      <ul>
                        {provenanceByItem[item.id].references.map((reference) => (
                          <li key={reference.messageId}>
                            {reference.excerptAvailable && reference.excerpt
                              ? `"${reference.excerpt}"`
                              : "Excerpt not approved for display."}
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
