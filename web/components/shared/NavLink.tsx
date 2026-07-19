"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Top-nav link that clearly marks the active route. The current page renders
 * as a filled slate pill (the app's primary action colour); other links are
 * quiet text that fill in on hover. `aria-current="page"` exposes the active
 * state to assistive tech.
 */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded bg-accent px-3 py-1.5 font-medium text-white"
          : "rounded px-3 py-1.5 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
      }
    >
      {children}
    </Link>
  );
}
