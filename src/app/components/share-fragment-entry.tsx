"use client";

import { useEffect, useRef, useState } from "react";
import { loadSharedReceiverViewAction } from "../../application/share-actions.js";
import { bindShareFragment, type ShareFragmentState } from "../../share/fragment-entry.js";
import { SharedReceiverConsole } from "./shared-receiver-console";

type SharedView = NonNullable<Awaited<ReturnType<typeof loadSharedReceiverViewAction>>>;
type EntryState = ShareFragmentState<SharedView>;

export function ShareFragmentEntry({ semanticModeEnabled, externalVerifierEnabled }: {
  semanticModeEnabled: boolean;
  externalVerifierEnabled: boolean;
}) {
  const tokenRef = useRef<string | null>(null);
  const [entry, setEntry] = useState<EntryState>({ status: "loading" });

  useEffect(() => bindShareFragment(window, tokenRef, loadSharedReceiverViewAction, setEntry), []);

  if (entry.status === "loading") return <p className="share-status panel" role="status">Loading shared Handoff…</p>;
  if (entry.status === "unavailable") return <p className="share-status panel" role="status">This share link is unavailable.</p>;

  return <>
    <header className="page-heading">
    <p className="eyebrow">Receive / Explore</p>
    <h2>Shared Receiver</h2>
    </header>
    <p className="receiver-notice">Access is authorized through this share link only. Canonical Handoff items remain the authority.</p>
    <SharedReceiverConsole
      key={entry.token}
      token={entry.token}
      version={entry.view.version}
      publishedAt={entry.view.publishedAt}
      items={entry.view.items}
      semanticModeEnabled={semanticModeEnabled}
      externalVerifierEnabled={externalVerifierEnabled}
    />
  </>;
}
