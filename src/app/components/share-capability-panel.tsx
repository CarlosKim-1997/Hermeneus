"use client";

import { useState } from "react";
import type { ShareCapabilityMetadata } from "../../share/types.js";
import {
  issueShareCapabilityAction,
  listShareCapabilitiesAction,
  revokeShareCapabilityAction,
} from "../../application/share-actions.js";

type Props = {
  handoffId: string;
  version: number;
  initialCapabilities: ShareCapabilityMetadata[];
};

export function ShareCapabilityPanel({ handoffId, version, initialCapabilities }: Props) {
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [issuedNotice, setIssuedNotice] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  async function refreshList() {
    const result = await listShareCapabilitiesAction({ handoffId, version });
    if (result.ok) setCapabilities(result.capabilities);
  }

  async function onCreate() {
    setPending(true);
    setError(null);
    setIssuedLink(null);
    setIssuedNotice(null);
    setCopyMessage("");
    try {
    const result = await issueShareCapabilityAction({ handoffId, version });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    const absolute =
      typeof window !== "undefined" ? `${window.location.origin}${result.sharePath}` : result.sharePath;
    setIssuedLink(absolute);
    setIssuedNotice(
      `버전 ${version}의 공유 링크를 만들었습니다. 이 링크는 항상 버전 ${version}을 엽니다. 링크 전체는 지금 한 번만 표시됩니다. 잃어버리면 새로 만들고 필요하면 이전 링크를 해제하세요.`,
    );
    setCapabilities((current) => [...current, result.capability]);
    } catch { setError("링크 생성 결과를 확인하지 못했습니다. 새로고침해 목록을 확인한 뒤 필요하면 새 링크를 만드세요."); }
    finally { setPending(false); }
  }

  async function onRevoke(capabilityId: string) {
    setPending(true);
    setError(null);
    try {
    const result = await revokeShareCapabilityAction({ capabilityId });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await refreshList();
    } catch { setError("접근 해제 결과를 확인하지 못했습니다. 새로고침하여 현재 상태를 확인하세요."); }
    finally { setPending(false); }
  }

  async function onCopy() {
    if (!issuedLink) return;
    setCopyMessage("");
    try {
      await navigator.clipboard.writeText(issuedLink);
      setCopyMessage("링크를 복사했습니다. 메일이나 메신저로 상대에게 보내세요.");
    } catch {
      setCopyMessage("자동 복사가 되지 않았습니다. 화면의 링크를 직접 선택해 복사하세요.");
    }
  }

  return (
    <section className="panel panel-share">
      <h3>상대에게 보낼 링크</h3>
      <p className="receiver-notice">
        이 링크를 가진 사람은 이 버전의 전달본을 볼 수 있습니다. 원하는 상대에게만 보내고, 더 이상 필요하지 않으면 접근을 해제하세요.
      </p>
      <button type="button" onClick={onCreate} disabled={pending}>
        {pending ? "처리 중…" : "이 버전의 공유 링크 만들기"}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {issuedNotice ? <p>{issuedNotice}</p> : null}
      {issuedLink ? (
        <p>
          지금 복사해 보관하세요: <code>{issuedLink}</code>{" "}
          <button type="button" onClick={onCopy}>
            링크 복사
          </button>
        </p>
      ) : null}
      {copyMessage ? <p className="inline-feedback" role="status">{copyMessage}</p> : null}
      {capabilities.length === 0 ? <p className="field-help">아직 만든 링크가 없습니다. 공유할 준비가 되면 위 버튼으로 만드세요.</p> : null}
      <ul>
        {capabilities.map((capability) => (
          <li key={capability.id}>
            <code>{capability.id.slice(0, 12)}…</code> · v{capability.version} · 생성{" "}
            {new Date(capability.createdAt).toLocaleString()} ·{" "}
            {capability.revokedAt ? `해제됨 · ${new Date(capability.revokedAt).toLocaleString('ko-KR')}` : "사용 가능"}
            {!capability.revokedAt ? (
              <>
                {" "}
                <button type="button" onClick={() => onRevoke(capability.id)} disabled={pending}>
                  접근 해제
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
