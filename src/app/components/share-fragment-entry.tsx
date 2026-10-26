"use client";

import { useEffect, useRef, useState } from "react";
import { loadSharedReceiverViewAction } from "../../application/share-actions.js";
import { bindShareFragment, type ShareFragmentState } from "../../share/fragment-entry.js";
import { SharedReceiverConsole } from "./shared-receiver-console";

type SharedView = NonNullable<Awaited<ReturnType<typeof loadSharedReceiverViewAction>>>;
type EntryState = ShareFragmentState<SharedView>;

export function ShareFragmentEntry({ semanticModeEnabled, externalVerifierEnabled, mcpOrigin }: {
  semanticModeEnabled: boolean;
  externalVerifierEnabled: boolean;
  mcpOrigin?: string;
}) {
  const tokenRef = useRef<string | null>(null);
  const [entry, setEntry] = useState<EntryState>({ status: "loading" });

  useEffect(() => bindShareFragment(window, tokenRef, loadSharedReceiverViewAction, setEntry), []);

  if (entry.status === "loading") return <p className="share-status panel" role="status">공유받은 전달본을 불러오는 중…</p>;
  if (entry.status === "unavailable") return <p className="share-status panel" role="status">이 공유 링크를 열 수 없습니다. 보낸 사람에게 새 링크를 요청해주세요.</p>;

  return <>
    <header className="page-heading">

    <h2>공유받은 전달본</h2>
    </header>
    <SharedReceiverConsole
      key={entry.token}
      token={entry.token}
      version={entry.view.version}
      publishedAt={entry.view.publishedAt}
      items={entry.view.items}
      semanticModeEnabled={semanticModeEnabled}
      externalVerifierEnabled={externalVerifierEnabled}
      mcpOrigin={mcpOrigin}
    />
  </>;
}
