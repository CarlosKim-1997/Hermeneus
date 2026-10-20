"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteHandoffAction, eraseSourceAction } from "../../application/actions";

type Props = {
  handoffId: string;
  sourceKind: "retained" | "erased" | "not_collected";
};

export function HandoffLifecyclePanel({ handoffId, sourceKind }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [eraseMessage, setEraseMessage] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);

  function confirmEraseSource() {
    setEraseMessage(null);
    startTransition(async () => {
      const result = await eraseSourceAction(handoffId);
      if (!result.ok) {
        setEraseMessage(result.error.message);
        return;
      }
      setShowEraseConfirm(false);
      router.refresh();
    });
  }

  function confirmDeleteHandoff() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteHandoffAction(handoffId);
      if (result && "error" in result) {
        setDeleteError(result.error.message);
      }
    });
  }

  return (
    <section className="panel panel-lifecycle" aria-labelledby="lifecycle-heading">
      <h2 id="lifecycle-heading">원문·전달 데이터 관리</h2>
      {sourceKind === "retained" ? (
        <div className="lifecycle-block">
          <h3>원문만 삭제</h3>
          <p>
            이 전달에서 대화 원문과 모든 원문 근거에 접근하는 연결을 영구 삭제합니다. 다른 전달에서 같은 원문을 사용하지 않으면 실제 원문도 삭제됩니다. 확정된 전달 내용과 기존 공유 링크는 유지됩니다. 되돌릴 수 없습니다.
          </p>
          {!showEraseConfirm ? (
            <button type="button" className="danger" onClick={() => setShowEraseConfirm(true)} disabled={pending}>
              원문 삭제 범위 확인
            </button>
          ) : (
            <div className="confirm-box">
              <p className="error">대화 원문과 원문 근거를 영구 삭제합니다. 확정된 전달 내용은 유지됩니다.</p>
              <div className="actions">
                <button type="button" onClick={() => setShowEraseConfirm(false)} disabled={pending}>
                  취소
                </button>
                <button type="button" className="danger" onClick={confirmEraseSource} disabled={pending}>
                  원문 영구 삭제
                </button>
              </div>
            </div>
          )}
          {eraseMessage ? (
            <p className="error" role="alert">
              {eraseMessage}
            </p>
          ) : null}
        </div>
      ) : sourceKind === "erased" ? (
        <p className="notice">이 전달의 원문 근거는 삭제되었습니다.</p>
      ) : (
        <p className="notice">이 전달은 대화 원문을 수집하지 않아 삭제할 원문이 없습니다.</p>
      )}

      <div className="lifecycle-block">
        <h3>전달 전체 삭제</h3>
        <p>
          이 전달의 초안·모든 확정 버전·모든 공유 링크를 삭제합니다. 다른 전달에서 참조하지 않는 원문도 함께 삭제됩니다. 되돌릴 수 없습니다.
        </p>
        {deleteStep === "idle" ? (
          <button type="button" className="danger" onClick={() => setDeleteStep("confirm")} disabled={pending}>
            전달 삭제 범위 확인
          </button>
        ) : (
          <div className="confirm-box">
            <p className="error">
              초안·모든 확정 전달본·공유 권한이 삭제됩니다. 공유 링크는 즉시 사용할 수 없게 됩니다.
            </p>
            <div className="actions">
              <button type="button" onClick={() => setDeleteStep("idle")} disabled={pending}>
                취소
              </button>
              <button type="button" className="danger" onClick={confirmDeleteHandoff} disabled={pending}>
                전달 전체 영구 삭제
              </button>
            </div>
          </div>
        )}
        {deleteError ? (
          <p className="error" role="alert">
            {deleteError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
