import type { ReactNode } from "react";
import "./globals.css";
import "./theme.css";
import "./reference-ui.css";

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">본문으로 바로 가기</a>
        <main className="app-shell" id="main-content" tabIndex={-1}>
          <header className="app-brand">
            <span className="brand-symbol" aria-hidden="true">H</span>
            <h1>Hermeneus</h1>

          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
