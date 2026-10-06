import { requireAccountLifecycleSessionPage } from "../../../application/creator-page-guards.js";
import { AccountLifecyclePanel } from "../../components/account-lifecycle-panel.js";

export default async function AccountPage() {
  const principal = await requireAccountLifecycleSessionPage();
  return (
    <main className="page">
      <h1>Account</h1>
      <AccountLifecyclePanel lifecycleStatus={principal.lifecycleStatus} />
    </main>
  );
}
