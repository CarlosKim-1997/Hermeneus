import { HandoffLibrary } from "../../components/handoff-library";
import { requireCreatorSessionPage } from "../../../application/creator-page-guards.js";
import { getRepositories } from "../../../application/runtime.js";
import { listCreatorHandoffs } from "../../../application/use-cases/list-creator-handoffs.js";

export default async function CreatorHandoffLibraryPage() {
  const principal = await requireCreatorSessionPage();
  const repos = getRepositories();
  const handoffs = await listCreatorHandoffs(repos, principal.creatorId);

  return <HandoffLibrary handoffs={handoffs} />;
}
