import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AIConsultantProvider } from "../contexts/AIConsultantContext";
import { SessionProvider } from "../contexts/SessionContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Innsight",
  description:
    "AI-powered hospitality digital twin and hotel investment simulator. All metrics are simulation estimates.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <SessionProvider>
          <AIConsultantProvider>{children}</AIConsultantProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
