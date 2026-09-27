import type { ReactNode } from "react";
import { CreatorNav } from "../components/creator-nav";
import { CreatorSessionBanner } from "../components/creator-session-banner";

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <p style={{ margin: "0 0 0.75rem", color: "#64748b", fontSize: "0.9rem" }}>
        Creator workspace · Local development only. Not safe for public deployment.
      </p>
      <CreatorSessionBanner />
      <CreatorNav />
      {children}
    </>
  );
}
