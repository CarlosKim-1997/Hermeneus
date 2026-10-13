import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel login-panel">
      <p className="eyebrow">Page unavailable</p>
      <h2>This page could not be found.</h2>
      <p>Check the address, or return to your Handoffs.</p>
      <Link className="button-link" href="/handoffs">Go to Handoffs</Link>
    </section>
  );
}
