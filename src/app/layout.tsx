import type { ReactNode } from "react";
import "./globals.css";

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <header style={{ marginBottom: "1rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Hermeneus</h1>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
