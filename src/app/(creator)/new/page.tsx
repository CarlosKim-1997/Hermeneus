import { ImportForm } from "../../components/import-form";
import { BootstrapForm } from "../../components/bootstrap-form";
import { SenderPromptGuide } from "../../components/sender-prompt-guide";
import { requireCreatorSessionPage } from "../../../application/creator-page-guards";

export default async function NewImportPage() {
  await requireCreatorSessionPage();
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">01 / Begin</p>
        <h2>Create a Handoff</h2>
        <p className="page-lead">Bring your material. Review what matters. Publish when you are ready.</p>
      </header>
      <div className="creation-layout">
      <section className="panel creation-proposal">
        <p className="eyebrow">From your AI</p>
        <h2>New Handoff from Portable Proposal</h2>
        <SenderPromptGuide />
        <BootstrapForm />
      </section>
      <section className="panel creation-import">
        <p className="eyebrow">From a conversation</p>
        <h2>Import a conversation</h2>
        <p>Use lines beginning with <code>creator:</code>, <code>assistant:</code>, or <code>other:</code>.</p>
        <ImportForm />
      </section>
      </div>
    </>
  );
}
