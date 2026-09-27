import Link from "next/link";
import { getOptionalCreatorSessionPage } from "../../application/creator-page-guards.js";

export async function CreatorNav() {
  const principal = await getOptionalCreatorSessionPage();
  if (!principal) return null;

  return (
    <nav className="creator-nav" aria-label="Creator">
      <Link href="/handoffs">Handoffs</Link>
      <Link href="/new">New Handoff</Link>
    </nav>
  );
}
