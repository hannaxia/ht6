import Image from "next/image";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import { AIConsultantProvider } from "../contexts/AIConsultantContext";
import { SessionProvider } from "../contexts/SessionContext";
import { AuthNav, SiteNav } from "../components/shared/AuthNav";
import { auth0 } from "../lib/auth0";
import "./globals.css";

export const metadata: Metadata = {
  title: "Innsight",
  description:
    "AI-powered hospitality digital twin and hotel investment simulator. All metrics are simulation estimates.",
  icons: {
    icon: "/favicon-innsight.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth0?.getSession();

  return (
    <html lang="en">
      <body className="flex h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-6">
              <a href="/">
                {/* Replace web/public/logo-innsight.png with your real wordmark */}
                <Image
                  src="/logo-innsight.png"
                  alt="Innsight"
                  width={120}
                  height={32}
                  className="h-8 w-auto"
                  priority
                />
              </a>
              <SiteNav />
            </div>
            <AuthNav />
          </div>
        </header>
        <SessionProvider initialSessionId={session?.user.sub}>
          <AIConsultantProvider>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </AIConsultantProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
