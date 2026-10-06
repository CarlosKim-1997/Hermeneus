"use client";

import { useState, useTransition } from "react";
import type { CreatorLifecycleStatus } from "../../creator/types.js";
import { deleteAccountAction, retryAccountErasureAction } from "../../application/account-actions.js";

type Props = {
  lifecycleStatus: CreatorLifecycleStatus;
};

export function AccountLifecyclePanel({ lifecycleStatus }: Props) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = confirmation === "DELETE";

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccountAction(confirmation);
      if (result && "error" in result) {
        setError(result.error.message);
      }
    });
  }

  function onRetry() {
    setError(null);
    startTransition(async () => {
      const result = await retryAccountErasureAction();
      if (result && "error" in result) {
        setError(result.error.message);
      }
    });
  }

  if (lifecycleStatus === "erasing") {
    return (
      <section className="panel panel-account">
        <h2>Account deletion in progress</h2>
        <p>
          Account deletion was initiated. Ordinary Handoff editing, publishing, and sharing are locked until deletion
          completes or is retried successfully.
        </p>
        <p>Deletion has not fully completed yet. You can retry account deletion below.</p>
        <button type="button" className="danger" onClick={onRetry} disabled={pending}>
          {pending ? "Working…" : "Retry account deletion"}
        </button>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="panel panel-account">
      <h2>Delete account</h2>
      <p>
        Permanently removes all Handoffs you own, including Drafts, Published versions, provenance, source associations
        for those Handoffs, and all Share links. Your external sign-in mapping and Creator lifecycle are deleted. This
        cannot be undone.
      </p>
      <p>
        If you sign in again later with the same external identity, you start a new Creator lifecycle. Previous Handoffs
        are not restored.
      </p>
      <label htmlFor="delete-confirm">Type DELETE to confirm</label>
      <input
        id="delete-confirm"
        name="delete-confirm"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="button" className="danger" onClick={onDelete} disabled={!canDelete || pending}>
        {pending ? "Working…" : "Delete account"}
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
