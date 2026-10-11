"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapHandoffAction } from "../../application/actions.js";
import { parsePortableProposal, type PortableProposal } from "../../portable/proposal.js";

export function BootstrapForm() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [proposal, setProposal] = useState<PortableProposal | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saveTitle, setSaveTitle] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function preview() {
    try {
      const parsed = parsePortableProposal(raw);
      setProposal(parsed);
      setRequestKey(crypto.randomUUID());
      setAcknowledged(false);
      setSaveTitle(false);
      setError("");
    } catch {
      setProposal(null);
      setError("Proposal format is invalid. Check the protocol, fields, IDs, and size limits.");
    }
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
  );
}
