"use client";

import { useState } from "react";
import { devSignInAction } from "../../application/auth-actions.js";

type Props = {
  showSecondary?: boolean;
};

export function DevSignInForm({ showSecondary = false }: Props) {
  const [pending, setPending] = useState<"primary" | "secondary" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn(slot: "primary" | "secondary") {
    setPending(slot);
    setError(null);
    const formData = new FormData();
    formData.set("slot", slot);
    const result = await devSignInAction(formData);
    setPending(null);
    if (result && "error" in result) {
      setError(result.error);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => onSignIn("primary")} disabled={pending !== null}>
        {pending === "primary" ? "Signing in…" : "Sign in as development Creator"}
      </button>
      {showSecondary ? (
        <button type="button" onClick={() => onSignIn("secondary")} disabled={pending !== null} style={{ marginLeft: "0.5rem" }}>
          {pending === "secondary" ? "Signing in…" : "Sign in as development Creator B"}
        </button>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
