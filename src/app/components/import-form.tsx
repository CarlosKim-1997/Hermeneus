"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importConversationAction } from "../../application/actions";

function ImportSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="primary" type="submit" disabled={pending}>
      {pending ? "Importing..." : "Import"}
    </button>
  );
}

export function ImportForm() {
  const [state, formAction] = useActionState(importConversationAction, null);

  return (
    <form action={formAction}>
      <label htmlFor="transcript">Conversation transcript</label>
      <textarea
        id="transcript"
        name="transcript"
        placeholder={"creator: I think the service should...\nassistant: One possible direction is...\ncreator: No, I want..."}
        required
      />
      {state?.error ? (
        <p className="error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="actions">
        <ImportSubmitButton />
      </div>
    </form>
  );
}
