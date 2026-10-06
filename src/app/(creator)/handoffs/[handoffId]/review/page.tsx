import { notFound } from "next/navigation";
import { fetchCreatorReview } from "../../../../../application/actions";
import { requireOwnedHandoffPage } from "../../../../../application/creator-page-guards";
import { HandoffLifecyclePanel } from "../../../../components/handoff-lifecycle-panel";
import { ReviewEditor } from "../../../../components/review-editor";

export default async function ReviewPage({ params }: { params: Promise<{ handoffId: string }> }) {
  const { handoffId } = await params;
  await requireOwnedHandoffPage(handoffId);
  const review = await fetchCreatorReview(handoffId);
  if (!review) notFound();

  return (
    <section>
      <h2>Creator Review</h2>
      <p>Handoff ID: {handoffId}</p>
      <HandoffLifecyclePanel handoffId={handoffId} sourceRetained={review.kind === "retained"} />
      <ReviewEditor
        key={`${handoffId}-${review.revision}-${review.kind}`}
        handoffId={handoffId}
        initialRevision={review.revision}
        initialItems={review.draft.items}
        reviewKind={review.kind}
        sourceConversation={review.kind === "retained" ? review.sourceConversation : undefined}
        erasedAt={review.kind === "erased" ? review.erasedAt : undefined}
      />
    </section>
  );
}
