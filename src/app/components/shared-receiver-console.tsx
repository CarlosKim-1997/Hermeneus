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
  SUPPORTED: "Directly supported by the approved Handoff.",
  DERIVED: "Follows only from approved items under conservative derivation rules.",
  OPEN: "The Creator explicitly left this unresolved.",
  UNKNOWN: "The approved Handoff does not contain enough information.",
};

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
  useEffect(() => () => { copyGeneration.current += 1; }, []);

  async function verifyPastedAnswer() {
    if (!packet || !externalAnswer.trim() || verificationPending || (externalVerifierEnabled && !externalVerificationConsent)) return;
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
      if (!outcome.ok) { setError(outcome.error); return; }
      setVerdict(outcome.result);
    } catch {
      setError("Verification is unavailable.");
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
      if (!result.ok) { setError(result.error.message); setPacket(null); return; }
      setPacket(result.packet);
    } catch {
      if (generation !== copyGeneration.current) return;
      setError("The Receiver Packet is unavailable.");
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
        setError("The Receiver Packet is unavailable.");
        return;
      }
      try {
        await navigator.clipboard.writeText(JSON.stringify(result.packet, null, 2));
        if (generation !== copyGeneration.current) return;
        setCopyMessage("Packet copied. You can paste it into your AI.");
      } catch {
        if (generation !== copyGeneration.current) return;
        setCopyMessage("Could not copy automatically. Select the Packet text below and copy it manually.");
      }
    } catch {
      if (generation !== copyGeneration.current) return;
      setPacket(null);
      setError("The Receiver Packet is unavailable. Try preparing it again.");
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
    setErrorContext("question");
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
        Shared Receiver view · pinned version {version}. Read the approved content below, then choose how to explore it.
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

      <nav className="receiver-route-choice" aria-label="Receiver routes">
        <div>
          <a href="#use-my-ai">Use my AI</a>
          <p>Copy the approved content into your own AI, then return with its answer.</p>
        </div>
        <div>
          <a href="#ask-here">Ask on this site</a>
          <p>Ask about the approved Handoff here, without copying a packet into your AI.</p>
        </div>
      </nav>

      <section id="use-my-ai" className="receiver-ai-path" aria-labelledby="my-ai-heading">
        <header>
          <p className="eyebrow">Your AI / Transfer and return</p>
          <h2 id="my-ai-heading">Use my AI</h2>
          <p>Prepare a packet, discuss it in your AI, then bring the answer back for a separate check.</p>
        </header>
      <section className="panel panel-transfer">
        <p className="eyebrow">My AI · Step 1</p>
        <h3>Prepare a Receiver Packet</h3>
        <p>Published items may contain sensitive information. Copying sends them to a third-party AI under that service&apos;s terms. Revoking this link cannot erase a copy already made elsewhere.</p>
        <label><input type="checkbox" checked={externalDisclosure} onChange={(event) => { copyGeneration.current += 1; setExternalDisclosure(event.target.checked); setPacket(null); setExternalVerificationConsent(false); setCopyMessage(""); }} /> I understand the external disclosure.</label>
        <div className="actions"><button type="button" disabled={!externalDisclosure || packetPending} onClick={preparePacket}>{packetPending ? "Preparing..." : "Prepare Receiver Packet"}</button></div>
        {!externalDisclosure ? <p className="field-help">Confirm the disclosure above to prepare a packet.</p> : null}
        {error && errorContext === "packet" ? <p className="form-error" role="alert">{error}</p> : null}
        {packet ? <>
          <p>Pinned version {packet.version} · fingerprint {packet.canonicalDigest}</p>
          <p>Paste the packet into your AI and ask it to distinguish approved items, open questions, and outside facts. Citation labels are hints, not proof.</p>
          <button type="button" disabled={copyPending} onClick={copyPacket}>{copyPending ? "Copying..." : "Copy packet"}</button>
          {copyMessage ? <p className="inline-feedback" role="status">{copyMessage}</p> : null}
          <label htmlFor="receiver-packet-text">Packet text</label>
          <textarea id="receiver-packet-text" readOnly value={JSON.stringify(packet, null, 2)} />
        </> : null}
      </section>

      <section className="panel panel-verification">
        <p className="eyebrow">My AI · Step 2 · Return here</p>
        <h3>Verify an AI answer</h3>
        {!externalVerifierEnabled ? (
          <div className="receiver-notice" id="verification-availability">
            <strong>Semantic verification is currently off.</strong>
            <p>Submitting an answer will return INDETERMINATE. Hermeneus cannot assess whether it agrees with the Published Canon in this environment.</p>
          </div>
        ) : null}
        <p>When semantic verification is enabled, Hermeneus checks the submitted answer against this Published Canon version. It does not check the original conversation or prove that a person understood it.</p>
        <p>Paste an answer only if you agree to disclose its contents to Hermeneus. The answer may include personal information from your AI session.</p>
        <label htmlFor="external-question">Question (optional)</label>
        <textarea id="external-question" value={externalQuestion} onChange={(event) => { setExternalQuestion(event.target.value); setExternalVerificationConsent(false); setVerdict(null); }} />
        <label htmlFor="external-answer">AI answer</label>
        <textarea id="external-answer" aria-describedby={!externalVerifierEnabled ? "verification-availability" : undefined} value={externalAnswer} onChange={(event) => { setExternalAnswer(event.target.value); setExternalVerificationConsent(false); setVerdict(null); }} />
        {externalVerifierEnabled ? <label>
          <input type="checkbox" checked={externalVerificationConsent} onChange={(event) => setExternalVerificationConsent(event.target.checked)} />
          For this check, I agree to send the pinned Published Canon items, my question, and this answer to OpenAI for verification. OpenAI's default API abuse-monitoring logs may contain this content for up to 30 days, with limited exceptions. Hermeneus does not persist this answer or my consent choice.
        </label> : null}
        <button type="button" disabled={!packet || !externalAnswer.trim() || verificationPending || (externalVerifierEnabled && !externalVerificationConsent)} onClick={verifyPastedAnswer}>{verificationPending ? "Checking..." : "Check answer"}</button>
        {!packet ? <p className="field-help">Prepare a Receiver Packet in “Use my AI” first.</p>
          : !externalAnswer.trim() ? <p className="field-help">Paste an AI answer to enable this check.</p>
          : externalVerifierEnabled && !externalVerificationConsent ? <p className="field-help">Confirm the per-check consent above to enable verification.</p> : null}
        {error && errorContext === "verification" ? <p className="form-error" role="alert">{error}</p> : null}
        {verdict ? <div className="verification-result" role="status"><strong>{verdict.verdict}</strong><p>{verdict.issues.join(" ")}</p><p>{verdict.limitations.join(" ")}</p></div> : null}
      </section>
      </section>

      <section id="ask-here" className="panel panel-receiver-qa" aria-labelledby="ask-here-heading">
        <p className="eyebrow">On this site / Questions</p>
        <h2 id="ask-here-heading">Ask on this site</h2>
        <p>Ask about the approved Handoff directly here. This is separate from checking an answer written by your own AI.</p>
        <p className="field-help">{semanticModeEnabled ? "Questions use this site's configured interpretation pipeline." : "Questions use deterministic interpretation in this environment."}</p>
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
                    <strong>{item.type}</strong>: {item.statement}
                    <div>
                      <button type="button" onClick={() => onShowProvenance(item.id)} disabled={provenancePending === item.id}>
                        {provenancePending === item.id ? "Loading…" : "Show source evidence"}
                      </button>
                    </div>
                    {provenanceByItem[item.id] ? (
                      <ul>
                        {provenanceByItem[item.id].references.map((reference, referenceIndex) => (
                          <li key={`${item.id}-ref-${referenceIndex}`}>
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
