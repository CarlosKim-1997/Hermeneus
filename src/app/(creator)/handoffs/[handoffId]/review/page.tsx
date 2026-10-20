import { notFound } from "next/navigation";
import { fetchCreatorReview } from "../../../../../application/actions";
import { requireOwnedHandoffPage } from "../../../../../application/creator-page-guards";
import { HandoffLifecyclePanel } from "../../../../components/handoff-lifecycle-panel";
import { ReviewEditor } from "../../../../components/review-editor";
import { HandoffSteps } from "../../../../components/handoff-presentation";

export default async function ReviewPage({ params }: { params: Promise<{ handoffId: string }> }) {
  const { handoffId } = await params;
  await requireOwnedHandoffPage(handoffId);
  const review = await fetchCreatorReview(handoffId);
  if (!review) notFound();

  return (
    <section className="review-page">
      <header className="page-heading">
      <p className="eyebrow">전달 내용 검토</p>
      <h2>내 뜻대로 전달될지 확인하세요.</h2>
      <p className="page-lead">요청과 배경이 충분한지, 확정한 내용과 미정인 내용이 구분되는지 검토하세요.</p>
      <p className="record-id">관리 번호: {handoffId}</p>
      </header>
      <HandoffSteps current={2} />
      <ReviewEditor
        key={`${handoffId}-${review.revision}-${review.kind}`}
        handoffId={handoffId}
        initialRevision={review.revision}
        initialItems={review.draft.items}
        reviewKind={review.kind}
        sourceConversation={review.kind === "retained" ? review.sourceConversation : undefined}
        erasedAt={review.kind === "erased" ? review.erasedAt : undefined}
      />
      <HandoffLifecyclePanel handoffId={handoffId} sourceKind={review.kind} />
    </section>
  );
}
