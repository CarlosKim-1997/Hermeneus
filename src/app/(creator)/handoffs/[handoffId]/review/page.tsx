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

      <h2>보낼 내용 검토</h2>
      <p className="page-lead">빠진 내용은 추가하고, 확정한 것과 미정인 것을 구분해주세요.</p>
      <details className="record-id"><summary>관리 정보</summary><p>관리 번호: {handoffId}</p></details>
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
