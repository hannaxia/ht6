"use client";

import { usePathname } from "next/navigation";

export function LoginLink() {
  const pathname = usePathname();
  const returnTo = pathname.startsWith("/") ? pathname : "/";

  return (
    <a
      href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}
      className="rounded bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700"
    >
      Log in
    </a>
  );
}
