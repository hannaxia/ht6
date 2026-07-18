import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AIConsultantProvider } from "../contexts/AIConsultantContext";
import { SessionProvider } from "../contexts/SessionContext";
import { AuthNav, SiteNav } from "../components/shared/AuthNav";
import { auth0 } from "../lib/auth0";
import "./globals.css";

export const metadata: Metadata = {
  title: "Innsight",
  description:
    "AI-powered hospitality digital twin and hotel investment simulator. All metrics are simulation estimates.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth0?.getSession();

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-6">
              <a href="/" className="font-bold text-slate-950">
                Innsight
              </a>
              <SiteNav />
            </div>
            <AuthNav />
          </div>
        </header>
        <SessionProvider initialSessionId={session?.user.sub}>
          <AIConsultantProvider>{children}</AIConsultantProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
