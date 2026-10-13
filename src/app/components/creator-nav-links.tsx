"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CreatorNavLinks({ activeCreator }: { activeCreator: boolean }) {
  const pathname = usePathname();
  const links = activeCreator
    ? [{ href: "/handoffs", label: "Handoffs" }, { href: "/new", label: "New Handoff" }, { href: "/account", label: "Account" }]
    : [{ href: "/account", label: "Account" }];
  return (
    <nav className="creator-nav" aria-label="Creator">
      {links.map(({ href, label }) => <Link key={href} href={href as "/handoffs"} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
