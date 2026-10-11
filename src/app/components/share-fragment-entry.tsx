"use client";

import { useEffect, useRef, useState } from "react";
import { loadSharedReceiverViewAction } from "../../application/share-actions.js";
import { SharedReceiverConsole } from "./shared-receiver-console";

type SharedView = NonNullable<Awaited<ReturnType<typeof loadSharedReceiverViewAction>>>;
type EntryState = { status: "loading" } | { status: "unavailable" } | { status: "ready"; token: string; view: SharedView };

export function ShareFragmentEntry({ semanticModeEnabled, externalVerifierEnabled }: {
  semanticModeEnabled: boolean;
  externalVerifierEnabled: boolean;
}) {
  const tokenRef = useRef<string | null>(null);
  const [entry, setEntry] = useState<EntryState>({ status: "loading" });

  useEffect(() => {
    // Keep the token for React's development effect replay, but remove it from
    // the address bar before any server action or application data request.
    if (tokenRef.current === null) {
      tokenRef.current = window.location.hash.slice(1);
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    const token = tokenRef.current;
    if (!token) {
      setEntry({ status: "unavailable" });
      return;
    }
    let active = true;
    loadSharedReceiverViewAction(token)
      .then((view) => {
        if (active) setEntry(view ? { status: "ready", token, view } : { status: "unavailable" });
      })
      .catch(() => {
        if (active) setEntry({ status: "unavailable" });
      });
    return () => { active = false; };
  }, []);

  if (entry.status === "loading") return <p role="status">Loading shared Handoff…</p>;
  if (entry.status === "unavailable") return <p role="status">This share link is unavailable.</p>;

  return <>
    <h2>Shared Receiver</h2>
    <p className="receiver-notice">Access is authorized through this share link only. Canonical Handoff items remain the authority.</p>
    <SharedReceiverConsole
      token={entry.token}
      version={entry.view.version}
      publishedAt={entry.view.publishedAt}
      items={entry.view.items}
      semanticModeEnabled={semanticModeEnabled}
      externalVerifierEnabled={externalVerifierEnabled}
    />
  </>;
}
