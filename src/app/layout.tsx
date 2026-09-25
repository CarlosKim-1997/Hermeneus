import type { ReactNode } from "react";
import "./globals.css";

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
          {children}
        </main>
      </body>
    </html>
  );
}
