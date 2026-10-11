import { ImportForm } from "../../components/import-form";
import { BootstrapForm } from "../../components/bootstrap-form";
import { requireCreatorSessionPage } from "../../../application/creator-page-guards";

export default async function NewImportPage() {
  await requireCreatorSessionPage();
  return (
    <>
      <section className="panel">
        <h2>New Handoff from Portable Proposal</h2>
        <p>Paste the Sender proposal JSON, review its items and transient notes, then create a Draft.</p>
        <BootstrapForm />
      </section>
      <section className="panel">
        <h2>Import a conversation</h2>
        <p>Use lines beginning with <code>creator:</code>, <code>assistant:</code>, or <code>other:</code>.</p>
        <ImportForm />
      </section>
    </>
  );
}
