import type { ReactNode } from "react";
import { CreatorNav } from "../components/creator-nav";
import { CreatorSessionBanner } from "../components/creator-session-banner";

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <p className="workspace-label">
        Creator workspace
      </p>
      <CreatorSessionBanner />
      <CreatorNav />
      {children}
    </>
  );
}
