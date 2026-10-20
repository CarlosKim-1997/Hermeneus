import { notFound } from "next/navigation";
import { isReceiverSemanticModeConfigured } from "../../../../../application/receiver-interpreter-config";
import { fetchReceiverPublishedViewAction } from "../../../../../application/receiver-actions";
import { requireOwnedHandoffPage } from "../../../../../application/creator-page-guards";
import { ReceiverConsole } from "../../../../components/receiver-console";

export default async function ReceiverPage({
  params,
}: {
  params: Promise<{ handoffId: string; version: string }>;
}) {
  const { handoffId, version: versionRaw } = await params;
  const version = Number(versionRaw);
  if (!Number.isInteger(version) || version <= 0) notFound();

  await requireOwnedHandoffPage(handoffId);
  const view = await fetchReceiverPublishedViewAction(handoffId, version);
  if (!view) notFound();

  return (
    <section className="receiver-page">
      <header className="page-heading">
      <p className="eyebrow">내 계정으로 읽기</p>
      <h2>확정한 맥락을 다시 살펴보세요.</h2>
      <p className="page-lead">내 계정으로 확인하는 전달본입니다. 상대에게는 확정 전달본 화면에서 만든 공유 링크를 보내세요.</p>
      <p className="record-id">
        관리 번호 <code>{handoffId}</code> · 버전 {version}
      </p>
      </header>
      <ReceiverConsole
        handoffId={view.handoffId}
        version={view.version}
        publishedAt={view.publishedAt}
        items={view.items}
        semanticModeEnabled={isReceiverSemanticModeConfigured()}
      />
    </section>
  );
}
