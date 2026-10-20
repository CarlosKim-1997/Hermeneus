"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importConversationAction } from "../../application/actions";

function ImportSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="primary" type="submit" disabled={pending}>
      {pending ? "가져오는 중…" : "원문 가져오기"}
    </button>
  );
}

export function ImportForm() {
  const [state, formAction] = useActionState(importConversationAction, null);

  return (
    <form action={formAction}>
      <label htmlFor="transcript">대화 원문</label>
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
