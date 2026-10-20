import { formatDateTimeUtc } from "../../../../../components/ui-dates";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPublishedHandoff } from "../../../../../../application/actions";
import { requireOwnedHandoffPage } from "../../../../../../application/creator-page-guards";
import { listShareCapabilitiesAction } from "../../../../../../application/share-actions";
import { ShareCapabilityPanel } from "../../../../../components/share-capability-panel";
import { HandoffSteps } from "../../../../../components/handoff-presentation";
import { PublishedDocument } from "../../../../../components/published-document";

export default async function PublishedPage({
  params,
}: {
  params: Promise<{ handoffId: string; version: string }>;
}) {
  const { handoffId, version: versionRaw } = await params;
  const version = Number(versionRaw);
  if (!Number.isInteger(version) || version <= 0) notFound();

  await requireOwnedHandoffPage(handoffId);
  const published = await fetchPublishedHandoff(handoffId, version);
  if (!published) notFound();

  const capabilityList = await listShareCapabilitiesAction({ handoffId, version });

  return (
    <section className="published-page">
      <header className="page-heading"><p className="eyebrow">전달본 확정·공유</p>
      <h2>이제 맥락을 건네세요.</h2>
      <p className="page-lead">전달 내용이 확정되었습니다. 이 버전의 링크를 만들어 원하는 상대에게 보내세요.</p>
      <p className="version-line">
        버전 <strong>{published.version}</strong> · 확정 {formatDateTimeUtc(published.publishedAt)}
      </p>
      </header><HandoffSteps current={3} />
      <p className="page-links">
        <Link href={`/receiver/${handoffId}/${version}`}>내 계정으로 전달본 읽기 · 버전 {version}</Link>
        <Link href={`/handoffs/${handoffId}/review`}>다음 버전 초안 편집</Link>
      </p>
      <div className="publication-layout"><div><PublishedDocument items={published.items} version={version} publishedAt={published.publishedAt} heading="상대에게 전달되는 내용"/>
      <p className="field-help">이 버전은 수정되지 않습니다. 내용을 바꾸려면 새 버전을 확정하세요. 원문 근거는 원문 수집·보관 여부에 따라 별도입니다.</p></div><aside className="publication-sharing"><ShareCapabilityPanel
        handoffId={handoffId}
        version={version}
        initialCapabilities={capabilityList.ok ? capabilityList.capabilities : []}
      /></aside></div>
    </section>
  );
}
