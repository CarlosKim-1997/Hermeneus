import { requireAccountLifecycleSessionPage } from "../../../application/creator-page-guards.js";
import { AccountLifecyclePanel } from "../../components/account-lifecycle-panel.js";

export default async function AccountPage() {
  const principal = await requireAccountLifecycleSessionPage();
  return (
    <section className="account-page">
      <header className="page-heading">
        <p className="eyebrow">Your workspace / Account</p>
        <h2>Account</h2>
        <p className="page-lead">Manage the lifecycle of your Creator account and its Handoffs.</p>
      </header>
      <AccountLifecyclePanel lifecycleStatus={principal.lifecycleStatus} />
    </section>
  );
}
