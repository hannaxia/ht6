import type { SimulateHotelOutput } from "../../lib/api/schemas";
import { EstimateLabel } from "../shared/EstimateLabel";

/** Before/after deltas shown when the AI consultant applies changes. */
export function ChangeSummary({
  before,
  after,
}: {
  before: Partial<SimulateHotelOutput>;
  after: Partial<SimulateHotelOutput>;
}) {
  const rows: { label: string; b?: number; a?: number; fmt: (v: number) => string }[] = [
    { label: "ADR", b: before.adr, a: after.adr, fmt: (v) => `$${v.toFixed(0)}` },
    {
      label: "Occupancy",
      b: before.occupancy,
      a: after.occupancy,
      fmt: (v) => `${v.toFixed(0)}%`,
    },
    {
      label: "Rating",
      b: before.rating,
      a: after.rating,
      fmt: (v) => v.toFixed(1),
    },
    {
      label: "Revenue",
      b: before.revenue,
      a: after.revenue,
      fmt: (v) => `$${Math.round(v).toLocaleString()}`,
    },
  ];
  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-sm">
      <p className="mb-2 flex items-center gap-2 font-medium text-slate-700">
        AI-applied change <EstimateLabel />
      </p>
      {rows.map((row) =>
        row.b !== undefined && row.a !== undefined ? (
          <p key={row.label} className="text-slate-600">
            {row.label}: {row.fmt(row.b)} → {row.fmt(row.a)}
          </p>
        ) : null,
      )}
    </div>
  );
}
