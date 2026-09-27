import { ImportForm } from "../../components/import-form";
import { requireCreatorSessionPage } from "../../../application/creator-page-guards";

export default async function NewImportPage() {
  await requireCreatorSessionPage();
  return (
    <section className="panel">
      <h2>New Handoff import</h2>
      <p>
        Use lines beginning with <code>creator:</code>, <code>assistant:</code>, or <code>other:</code>.
      </p>
      <ImportForm />
    </section>
  );
}
