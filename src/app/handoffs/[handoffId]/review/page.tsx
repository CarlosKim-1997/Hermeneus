import { notFound } from "next/navigation";
import { fetchCreatorReview } from "../../../../application/actions";
import { ReviewEditor } from "../../../components/review-editor";

export default async function ReviewPage({ params }: { params: Promise<{ handoffId: string }> }) {
  const { handoffId } = await params;
  const review = await fetchCreatorReview(handoffId);
  if (!review) notFound();

  return (
    <section>
      <h2>Creator Review</h2>
      <p>Handoff ID: {handoffId}</p>
      <ReviewEditor
        handoffId={handoffId}
        initialRevision={review.revision}
        initialItems={review.draft.items}
        sourceConversation={review.sourceConversation}
      />
    </section>
  );
}
