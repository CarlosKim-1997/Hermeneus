"use client";

import { useState, type FormEvent } from "react";
import type { HandoffItemType, HandoffPriority } from "../../handoff/schema.js";
import type { ProvenanceBundle } from "../../persistence/receiver-types.js";
import type { Answerability } from "../../receiver/interpret.js";
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
};

const CLASSIFICATION_HELP: Record<Answerability, string> = {
  SUPPORTED: "Directly supported by the approved Handoff.",
  DERIVED: "Follows only from approved items under conservative derivation rules.",
  OPEN: "The Creator explicitly left this unresolved.",
  UNKNOWN: "The approved Handoff does not contain enough information.",
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
    const result = await askReceiverQuestionAction({ handoffId, version, question });
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
    });
  }

  async function onShowProvenance(itemId: string) {
    setProvenancePending(itemId);
    setError(null);
    const result = await fetchReceiverProvenanceAction({ handoffId, version, itemIds: [itemId] });
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
        {semanticModeEnabled
          ? "Receiver uses live semantic interpretation over this pinned canonical Handoff."
          : "Receiver interpretation is currently deterministic. Live natural-language interpretation is not enabled yet."}
      </p>

      <section className="panel panel-receiver">
        <h2>Published Handoff (Receiver view)</h2>
        <p>
          Version <strong>{version}</strong> · Published {new Date(publishedAt).toLocaleString()}
        </p>
        <p className="receiver-pin">Pinned to version {version}. This view does not follow newer publications automatically.</p>
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
          <label htmlFor="receiver-question">Your question</label>
          <textarea
            id="receiver-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Example: Are we building web first?"
            rows={3}
          />
          <div className="actions">
            <button type="submit" className="primary" disabled={pending || !question.trim()}>
              {pending ? "Answering…" : "Ask"}
            </button>
          </div>
        </form>

        {error ? <p className="error">{error}</p> : null}

        {answer ? (
          <div className="receiver-answer">
            <p className={`answerability answerability-${answer.classification.toLowerCase()}`}>
              <span className="answerability-label">{answer.classification}</span>
              <span className="answerability-help">{CLASSIFICATION_HELP[answer.classification]}</span>
            </p>
            <p>{answer.answer}</p>
            {answer.interpretationNotice ? <p className="notice">{answer.interpretationNotice}</p> : null}
            {answer.citedItems.length > 0 ? (
              <div className="receiver-citations">
                <h4>Canonical citations</h4>
                {answer.citedItems.map((item) => (
                  <article key={item.id} className="item-card citation-card">
                    <div>
                      <strong>{item.type}</strong> · {item.priority}
                    </div>
                    <p>{item.statement}</p>
                    <div className="actions">
                      <button type="button" onClick={() => onShowProvenance(item.id)} disabled={provenancePending === item.id}>
                        {provenancePending === item.id ? "Loading…" : "Show source evidence"}
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
                                Source reference exists, but no Receiver-safe excerpt is available.
                              </p>
                            )}
                            <p className="provenance-meta">Message {reference.messageId}</p>
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
