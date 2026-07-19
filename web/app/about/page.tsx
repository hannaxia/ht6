import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Innsight",
  description:
    "How Innsight scores hotel-building opportunities and where its underlying data comes from. All figures are simulation estimates.",
};

const OPPORTUNITY_FACTORS = [
  {
    title: "Revenue potential",
    weight: "adds to the score",
    body: "Estimated annual room revenue for a hypothetical hotel in the cell — predicted ADR × occupancy × rooms × 365. Higher potential earnings push the score up.",
  },
  {
    title: "Demand",
    weight: "adds to the score",
    body: "A city-average baseline demand adjusted for how attractive the specific location is — driven by tourism, business, and transit access. Areas where more travellers want to stay score higher.",
  },
  {
    title: "Segment-weighted competition",
    weight: "subtracts from the score",
    body: "Not raw hotel density — nearby hotels count more the closer they are in star level, type, and price band. A new luxury hotel is barely affected by a nearby budget motel, but heavily affected by comparable luxury properties.",
  },
  {
    title: "Risk",
    weight: "subtracts from the score",
    body: "Built from concrete inputs: local market and price volatility, construction cost relative to the city average, and demand concentration / seasonality. More uncertainty lowers the score.",
  },
];

const LOCATION_SIGNALS = [
  "Tourism score",
  "Business-district score",
  "Transit access",
  "Population density",
  "Existing hotel density",
];

const DATA_SOURCES = [
  {
    title: "Stay22",
    body: "The sole real-world market source: hotel names, coordinates, ratings, amenities, and booking links. Prices are an average nightly rate — Stay22 returns a total for a 30-night stay, which we divide by the number of nights. Because availability varies by date, we query two 30-night windows (roughly 30 and 60 days out) and merge them by property, keeping the nearer window's price. Up to 300 properties are pulled per area, 50 per request. Inventory is scraped into our database ahead of time rather than fetched live on each load, staying within Stay22's 150 requests/minute limit. Stay22 provides no revenue, occupancy, or profit data — those are always our own predictions.",
  },
  {
    title: "Web scraping & open geodata",
    body: "The scrape job covers ~20 major Canadian cities plus 300+ Ontario towns; the town list was generated from GeoNames' free Canada gazetteer. Per-area location scores (tourism, business, transit, and density) are seeded into a Locations collection.",
  },
  {
    title: "Kaggle & public datasets (ML models)",
    body: "The occupancy and ADR predictors train on a North-American short-term-rental dataset of 70,000+ listings — but it's ~72% US and only ~9% Canadian, so predictions are directional, not Canada-specific. Amenity effects are modeled for the 8 of 15 amenities that carry real statistical signal (e.g. wifi, parking, pool); the rest use hand-tuned values. A separate US hotel-reviews dataset trains the rating model, which scores 14 guest-experience aspects extracted from review text.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">About Innsight</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Innsight is a hotel investment simulator. It helps answer where to build
        a hotel, what kind, and which decisions maximize profitability — it is
        not a booking tool. Every predicted figure (ADR, occupancy, rating,
        revenue, ROI, and the opportunity score) is a{" "}
        <span className="font-medium text-slate-800">simulation estimate</span>,
        never real financial data.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">
          How the opportunity score works
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          The city map is divided into a grid. Each cell simulates a
          hypothetical hotel and gets an Opportunity Score from 0 to 100. The
          score is a weighted sum of four factors, each normalized across the
          whole grid so different units (dollars vs. scores) can be compared
          fairly:
        </p>
        <ul className="mt-4 space-y-3">
          {OPPORTUNITY_FACTORS.map((factor) => (
            <li
              key={factor.title}
              className="rounded border border-slate-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {factor.title}
                </h3>
                <span className="shrink-0 text-xs font-medium text-slate-500">
                  {factor.weight}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {factor.body}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Demand and competition draw on per-location signals seeded for each
          area:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LOCATION_SIGNALS.map((signal) => (
            <span
              key={signal}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {signal}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">
          Where the data comes from
        </h2>
        <ul className="mt-4 space-y-3">
          {DATA_SOURCES.map((source) => (
            <li
              key={source.title}
              className="rounded border border-slate-200 bg-white p-4"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                {source.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {source.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 rounded border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
        Revenue, ROI, and payback figures are deterministic calculations layered
        on top of the model predictions — there is no dataset for construction or
        operating costs, so those use tunable industry-style assumptions. Treat
        all outputs as estimates for exploring scenarios, not as financial
        advice.
      </p>
    </main>
  );
}
