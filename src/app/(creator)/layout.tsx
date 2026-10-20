import type { ReactNode } from "react";
import { CreatorNav } from "../components/creator-nav";
import { CreatorSessionBanner } from "../components/creator-session-banner";

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <p className="workspace-label">내 작업 공간</p>
        <CreatorNav />
        <div className="sidebar-note"><span aria-hidden="true">↗</span><p>맥락을 정리하고,<br />설명은 각자의 AI에서.</p></div>
        <CreatorSessionBanner />
      </aside>
      <div className="workspace-content">{children}</div>
    </div>
  );
}
