"use client";

import { useState, useTransition } from "react";
import { importConversationAction } from "../../application/actions";

export function ImportForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await importConversationAction(formData);
          if (result && "error" in result && result.error) {
            setError(typeof result.error === "string" ? result.error : result.error.message);
          }
        });
      }}
    >
      <label htmlFor="transcript">Conversation transcript</label>
      <textarea
        id="transcript"
        name="transcript"
        placeholder={"creator: I think the service should...\nassistant: One possible direction is...\ncreator: No, I want..."}
        required
      />
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="actions">
        <button className="primary" type="submit" disabled={pending}>
          {pending ? "Importing..." : "Import"}
        </button>
      </div>
    </form>
  );
}
