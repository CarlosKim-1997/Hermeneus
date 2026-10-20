"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CreatorLifecycleStatus } from "../../creator/types.js";
import { deleteAccountAction, retryAccountErasureAction } from "../../application/account-actions.js";

type Props = {
  lifecycleStatus: CreatorLifecycleStatus;
};

export function AccountLifecyclePanel({ lifecycleStatus }: Props) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = confirmation === "DELETE";

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccountAction(confirmation);
      if (result && "error" in result) {
        if (result.error.code === "ERASURE_INCOMPLETE") {
          setError(result.error.message);
          router.refresh();
          return;
        }
        setError(result.error.message);
      }
    });
  }

  function onRetry() {
    setError(null);
    startTransition(async () => {
      const result = await retryAccountErasureAction();
      if (result && "error" in result) {
        if (result.error.code === "ERASURE_INCOMPLETE") {
          setError(result.error.message);
          router.refresh();
          return;
        }
        setError(result.error.message);
      }
    });
  }

  if (lifecycleStatus === "erasing") {
    return (
      <section className="panel panel-account">
        <h2>계정 삭제를 마무리하고 있습니다</h2>
        <p>
          계정 삭제가 시작되었습니다. 삭제가 완료될 때까지 전달 내용의 편집·확정·공유는 잠깁니다.
        </p>
        <p>아직 삭제가 완료되지 않았습니다. 아래에서 다시 시도할 수 있습니다.</p>
        <button type="button" className="danger" onClick={onRetry} disabled={pending}>
          {pending ? "처리 중…" : "계정 삭제 다시 시도"}
        </button>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="panel panel-account">
      <h2>계정 영구 삭제</h2>
      <p>
        내가 만든 모든 초안·확정 전달본·원문 근거·원문 연결과 공유 링크를 영구 삭제합니다. 외부 로그인 연결과 현재 계정의 기록도 삭제되며 되돌릴 수 없습니다.
      </p>
      <p>
        같은 Google 계정으로 다시 로그인해도 새 계정으로 시작합니다. 이전 전달 데이터는 복구되지 않습니다.
      </p>
      <label htmlFor="delete-confirm">삭제하려면 DELETE를 정확히 입력하세요</label>
      <input
        id="delete-confirm"
        name="delete-confirm"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="button" className="danger" onClick={onDelete} disabled={!canDelete || pending}>
        {pending ? "처리 중…" : "계정 영구 삭제"}
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
