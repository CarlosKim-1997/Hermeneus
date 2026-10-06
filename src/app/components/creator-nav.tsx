import Link from "next/link";
import { getOptionalCreatorSessionPage } from "../../application/creator-page-guards.js";

export async function CreatorNav() {
  const principal = await getOptionalCreatorSessionPage();
  if (!principal) return null;

  return (
    <nav className="creator-nav" aria-label="Creator">
      {principal.lifecycleStatus === "active" ? (
        <>
          <Link href="/handoffs">Handoffs</Link>
          <Link href="/new">New Handoff</Link>
        </>
      ) : null}
      <Link href={"/account" as "/handoffs"}>Account</Link>
    </nav>
  );
}
