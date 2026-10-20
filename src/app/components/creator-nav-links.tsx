"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UiIcon } from "./ui-icon";

export function CreatorNavLinks({ activeCreator }: { activeCreator: boolean }) {
  const pathname = usePathname();
  const links = activeCreator
    ? [{ href: "/handoffs", label: "내 전달함", icon: "library" as const }, { href: "/new", label: "새 전달 만들기", icon: "plus" as const }, { href: "/account", label: "계정·데이터", icon: "account" as const }]
    : [{ href: "/account", label: "계정·데이터", icon: "account" as const }];
  return (
    <nav className="creator-nav" aria-label="내 작업 공간">
      {links.map(({ href, label, icon }) => <Link key={href} href={href as "/handoffs"} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}><UiIcon name={icon}/>{label}</Link>)}
    </nav>
  );
}
