import Image from "next/image";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SessionProvider } from "../contexts/SessionContext";
import { AuthNav, SiteNav } from "../components/shared/AuthNav";
import { auth0 } from "../lib/auth0";
import "./globals.css";

export const metadata: Metadata = {
  title: "Innsight",
  description:
    "AI-powered hospitality digital twin and hotel investment simulator. All metrics are simulation estimates.",
  icons: {
    icon: "/favicon-innsight-transparent.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth0?.getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
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
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </SessionProvider>
      </body>
    </html>
  );
}
