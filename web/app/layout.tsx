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
    icon: {
      url: "/favicon-innsight-transparent.png",
      type: "image/png",
    },
    shortcut: "/favicon-innsight-transparent.png",
    apple: "/favicon-innsight-transparent.png",
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
        <header className="site-header shrink-0">
          <div className="site-header-inner flex items-center justify-between">
            <div className="flex items-center gap-6">
              <a href="/" className="site-brand" aria-label="Innsight home">
                <Image
                  src="/favicon-innsight-transparent.png"
                  alt=""
                  width={34}
                  height={34}
                  className="site-brand-mark"
                  priority
                />
                <span className="site-brand-name">
                  Inns<span>i</span>ght
                </span>
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
