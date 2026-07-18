import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-bold">Innsight</h1>
      <p className="mt-3 max-w-prose text-slate-600">
        A hospitality digital twin: explore real hotel markets, simulate a hotel
        you might build or renovate, and see estimated ADR, occupancy, revenue,
        rating, and payback for every decision. Every figure is a simulation
        estimate — never real financial data.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/discover"
          className="rounded border border-slate-300 bg-white px-5 py-3 text-sm font-medium hover:bg-slate-100"
        >
          Market Discovery →
        </Link>
        <Link
          href="/sandbox"
          className="rounded border border-slate-300 bg-white px-5 py-3 text-sm font-medium hover:bg-slate-100"
        >
          Hotel Sandbox →
        </Link>
      </div>
    </main>
  );
}
