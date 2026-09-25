import Link from "next/link";
import { ImportForm } from "./components/import-form";

export default function HomePage() {
  return (
    <section className="panel">
      <h2>Import conversation</h2>
      <p>Paste a generic role-prefixed transcript. Native ChatGPT, Claude, or Gemini export import is not supported in this milestone.</p>
      <ImportForm />
      <p style={{ marginTop: "1rem" }}>
        <Link href="/new">Open import page</Link>
      </p>
    </section>
  );
}
