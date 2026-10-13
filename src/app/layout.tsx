import type { ReactNode } from "react";
import "./globals.css";
import "./theme.css";

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="app-shell">
          <header className="app-brand">
            <span className="brand-symbol" aria-hidden="true">H</span>
            <h1>Hermeneus</h1>
            <span className="brand-caption">A clearer handoff.</span>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
