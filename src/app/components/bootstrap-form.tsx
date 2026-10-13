"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapHandoffAction } from "../../application/actions.js";
import { parsePortableProposal, PortableProposalError, type PortableProposal } from "../../portable/proposal.js";

function previewErrorMessage(error: unknown): string {
  if (error instanceof PortableProposalError) {
    if (error.code === "JSON_INVALID") {
      return "The proposal is not valid JSON. Copy only the text inside the code block, without its markers.";
    }
    if (error.code === "LIMIT_EXCEEDED") return "The proposal exceeds the size limit.";
    if (error.code === "DUPLICATE_KEY" || error.code === "DUPLICATE_PROPOSAL_ID") {
      return "The proposal repeats a field or proposal ID.";
    }
    if (error.code === "PROTOCOL_UNSUPPORTED") return "The proposal protocol is unsupported.";
    return "A proposal field or value is invalid. Check each item's ID, type, priority, and statement.";
  }
  return "This browser could not prepare the preview. Reload the page and try again.";
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
      setError("Could not create the Handoff. You can retry safely.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label htmlFor="portable-proposal">Portable Proposal JSON</label>
      <textarea
        id="portable-proposal"
        value={raw}
        onChange={(event) => { setRaw(event.target.value); setProposal(null); setAcknowledged(false); setSaveTitle(false); setError(""); }}
        placeholder={'{"protocol":"hermeneus.portable-proposal/v0","items":[...]}' }
      />
      <div className="actions"><button type="button" onClick={preview}>Preview proposal</button></div>
      <div ref={feedbackRef} tabIndex={-1} aria-live="polite">
        {proposal ? (
          <section aria-label="Proposal preview">
            <h3>Review before creating a Draft</h3>
            <p>These are untrusted suggestions. Edit the Draft before publication.</p>
            <ol>{proposal.items.map((item) => <li key={item.proposalId}><strong>{item.type}</strong> ({item.priority}): {item.statement}</li>)}</ol>
            {proposal.title ? (
              <label>
                <input type="checkbox" checked={saveTitle} onChange={(event) => setSaveTitle(event.target.checked)} />
                Save “{proposal.title}” as private navigation metadata. It will not be published or shared.
              </label>
            ) : null}
            <h4>Review notes</h4>
            {proposal.reviewNotes?.length ? <ul>{proposal.reviewNotes.map((note, index) => <li key={index}>{note}</li>)}</ul> : <p>No review notes.</p>}
            <p>Review notes disappear after this step. If one belongs in the Canon, add it manually to the Draft after creation.</p>
            <label>
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
              I have reviewed the notes and understand they will not be saved.
            </label>
            <div className="actions"><button className="primary" type="button" disabled={!acknowledged || pending} onClick={create}>{pending ? "Creating..." : "Create Draft"}</button></div>
          </section>
        ) : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
