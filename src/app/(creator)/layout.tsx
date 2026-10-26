import type { ReactNode } from "react";
import { CreatorNav } from "../components/creator-nav";
import { CreatorSessionBanner } from "../components/creator-session-banner";

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">

        <CreatorNav />

        <CreatorSessionBanner />
      </aside>
      <div className="workspace-content">{children}</div>
    </div>
  );
}
