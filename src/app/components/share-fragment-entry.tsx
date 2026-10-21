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
    <p className="eyebrow">공유받은 전달</p>
    <h2>전달할 맥락이 도착했어요.</h2>
    </header>
    <p className="receiver-notice">이 링크로 공유된 전달본을 볼 수 있습니다. 아래 내용이 보낸 사람이 확정한 기준입니다.</p>
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
