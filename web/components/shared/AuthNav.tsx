import { auth0, isAuth0Configured } from "../../lib/auth0";
import { LoginLink } from "./LoginLink";
import { NavLink } from "./NavLink";

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
          <NavLink href="/profile">Profile</NavLink>
          <a
            href="/auth/logout"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 font-medium transition-colors hover:border-slate-900 hover:bg-slate-900 hover:text-white"
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
    <div className="flex items-center gap-2 text-sm">
      <NavLink href="/discover">Discover</NavLink>
      <NavLink href="/about">About</NavLink>
    </div>
  );
}
