import Link from "next/link";
import { auth0, isAuth0Configured } from "../../lib/auth0";
import { LoginLink } from "./LoginLink";

export async function AuthNav() {
  if (!isAuth0Configured || !auth0) {
    return (
      <span
        className="text-xs text-slate-500"
        title="Add Auth0 credentials to the root .env file"
      >
        Login not configured
      </span>
    );
  }

  const session = await auth0.getSession();

  return (
    <nav className="flex items-center gap-4 text-sm" aria-label="Account">
      {session ? (
        <>
          <Link
            href="/profile"
            className="text-slate-600 hover:text-slate-950"
          >
            {session.user.name ?? session.user.email ?? "Profile"}
          </Link>
          <a
            href="/auth/logout"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-100"
          >
            Log out
          </a>
        </>
      ) : (
        <LoginLink />
      )}
    </nav>
  );
}

export function SiteNav() {
  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/discover" className="text-slate-600 hover:text-slate-950">
        Discover
      </Link>
      <Link href="/sandbox" className="text-slate-600 hover:text-slate-950">
        Sandbox
      </Link>
    </div>
  );
}
