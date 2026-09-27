import type { ReactNode } from "react";
import { CreatorNav } from "./components/creator-nav";
import { CreatorSessionBanner } from "./components/creator-session-banner";
import "./globals.css";

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <header style={{ marginBottom: "1rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Hermeneus Creator</h1>
            <p style={{ margin: "0.25rem 0 0", color: "#64748b" }}>
              Local development only. Not safe for public deployment.
            </p>
          </header>
          <CreatorSessionBanner />
          <CreatorNav />
          {children}
        </main>
      </body>
    </html>
  );
}
