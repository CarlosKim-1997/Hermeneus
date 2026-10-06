"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteHandoffAction, eraseSourceAction } from "../../application/actions";

type Props = {
  handoffId: string;
  sourceRetained: boolean;
};

export function HandoffLifecyclePanel({ handoffId, sourceRetained }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [eraseMessage, setEraseMessage] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);

  function confirmEraseSource() {
    setEraseMessage(null);
    startTransition(async () => {
      const result = await eraseSourceAction(handoffId);
      if (!result.ok) {
        setEraseMessage(result.error.message);
        return;
      }
      setShowEraseConfirm(false);
      router.refresh();
    });
  }

  function confirmDeleteHandoff() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteHandoffAction(handoffId);
      if (result && "error" in result) {
        setDeleteError(result.error.message);
      }
    });
  }

  return (
    <section className="panel panel-lifecycle" aria-labelledby="lifecycle-heading">
      <h2 id="lifecycle-heading">Handoff lifecycle</h2>
      {sourceRetained ? (
        <div className="lifecycle-block">
          <h3>Erase Source</h3>
          <p>
            Permanently removes this Handoff&apos;s access to the imported source conversation and all provenance for
            this Handoff. If no other Handoff still uses the same physical source, that source is deleted as well.
            Approved canonical meaning and existing Share links remain. This cannot be undone.
          </p>
          {!showEraseConfirm ? (
            <button type="button" className="danger" onClick={() => setShowEraseConfirm(true)} disabled={pending}>
              Erase Source…
            </button>
          ) : (
            <div className="confirm-box">
              <p className="error">Source and provenance will be permanently erased. Canonical Handoff meaning stays.</p>
              <div className="actions">
                <button type="button" onClick={() => setShowEraseConfirm(false)} disabled={pending}>
                  Cancel
                </button>
                <button type="button" className="danger" onClick={confirmEraseSource} disabled={pending}>
                  Confirm Erase Source
                </button>
              </div>
            </div>
          )}
          {eraseMessage ? (
            <p className="error" role="alert">
              {eraseMessage}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="notice">Source provenance has been erased for this Handoff.</p>
      )}

      <div className="lifecycle-block">
        <h3>Delete Handoff</h3>
        <p>
          Removes the Draft, every Published version, and every Share link for this Handoff. If no other Handoff
          references the source, the physical source conversation is deleted too. Irreversible.
        </p>
        {deleteStep === "idle" ? (
          <button type="button" className="danger" onClick={() => setDeleteStep("confirm")} disabled={pending}>
            Delete Handoff…
          </button>
        ) : (
          <div className="confirm-box">
            <p className="error">
              This deletes the Draft, all Published versions, and all Share capabilities. Share links stop working
              immediately.
            </p>
            <div className="actions">
              <button type="button" onClick={() => setDeleteStep("idle")} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={confirmDeleteHandoff} disabled={pending}>
                Permanently delete Handoff
              </button>
            </div>
          </div>
        )}
        {deleteError ? (
          <p className="error" role="alert">
            {deleteError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
