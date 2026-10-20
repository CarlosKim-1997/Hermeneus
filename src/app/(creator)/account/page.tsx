import { requireAccountLifecycleSessionPage } from "../../../application/creator-page-guards.js";
import { AccountLifecyclePanel } from "../../components/account-lifecycle-panel.js";

export default async function AccountPage() {
  const principal = await requireAccountLifecycleSessionPage();
  return (
    <section className="account-page">
      <header className="page-heading">
        <p className="eyebrow">내 작업 공간 / 계정·데이터</p>
        <h2>계정·데이터</h2>
        <p className="page-lead">계정과 전달 데이터의 삭제 범위를 확인하고 관리하세요.</p>
      </header>
      <AccountLifecyclePanel lifecycleStatus={principal.lifecycleStatus} />
    </section>
  );
}
