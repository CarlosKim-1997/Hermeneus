"use client";

import { useState } from "react";
import { SENDER_BOOTSTRAP_PROMPT } from "../../portable/sender-prompt";

export function SenderPromptGuide() {
  const [copyMessage, setCopyMessage] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(SENDER_BOOTSTRAP_PROMPT);
      setCopyMessage("Sender prompt copied. Paste it into the AI conversation where you developed the idea.");
    } catch {
      setShowPrompt(true);
      setCopyMessage("Automatic copy is unavailable. Select the prompt below and copy it manually.");
    }
  }

  return (
    <section aria-labelledby="sender-guide-heading">
      <h3 id="sender-guide-heading">Start in your AI conversation</h3>
      <ol>
        <li>Copy the Sender prompt below.</li>
        <li>Paste it into the existing AI conversation where you developed the idea.</li>
        <li>Bring the generated JSON back here and preview it.</li>
        <li>Check the suggestions and notes, then review the Draft before publishing.</li>
      </ol>
      <p className="field-help">The AI can use only context available in that conversation. Its output is a proposal, not verified Canon. Hermeneus does not collect your original conversation through this path.</p>
      <div className="actions">
        <button type="button" onClick={copyPrompt}>Copy Sender prompt</button>
        <button type="button" aria-expanded={showPrompt} aria-controls="sender-prompt-content" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? "Hide prompt" : "View prompt"}</button>
      </div>
      {copyMessage ? <p className="inline-feedback" role="status">{copyMessage}</p> : null}
      <div id="sender-prompt-content" hidden={!showPrompt}>
        <label htmlFor="sender-prompt-text">Sender prompt</label>
        <textarea id="sender-prompt-text" readOnly rows={12} value={SENDER_BOOTSTRAP_PROMPT} />
      </div>
      <h3>Bring back your Proposal JSON</h3>
    </section>
  );
}
