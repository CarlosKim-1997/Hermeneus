import { requireCreatorSessionPage } from "../../../application/creator-page-guards";
import { NewHandoffWorkspace } from "../../components/new-handoff-workspace";

export default async function NewImportPage() {
  await requireCreatorSessionPage();
  return <NewHandoffWorkspace />;
}
