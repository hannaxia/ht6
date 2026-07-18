import type { SimulateHotelOutput } from "../../lib/api/schemas";
import { log } from "../../lib/log";
import { MetricCard } from "./MetricCard";

// All simulated dollar figures are CAD — see api/src/simulation/index.ts
// (ML predictions are converted from the training data's USD; deterministic
// fallback values are CAD-native config placeholders).
function cad(value: number): string {
  return `$${Math.round(value).toLocaleString()} CAD`;
}

export function MetricsPanel({ metrics }: { metrics: SimulateHotelOutput }) {
  if (!metrics.disclaimer) {
    // Backend should always send a disclaimer; fall back to labels + warn.
    log.warn("simulation response missing disclaimer field");
  }
  const payback =
    metrics.paybackYears === null || !Number.isFinite(metrics.paybackYears)
      ? "∞"
      : `${metrics.paybackYears.toFixed(1)} yrs`;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="ADR / night" value={cad(metrics.adr)} />
        <MetricCard
          label="Occupancy"
          value={`${metrics.occupancy.toFixed(0)}%`}
        />
        <MetricCard label="Annual revenue" value={cad(metrics.revenue)} />
        <MetricCard label="Guest rating" value={metrics.rating.toFixed(1)} />
        <MetricCard label="Investment" value={cad(metrics.investment)} />
        <MetricCard
          label="Operating profit / yr"
          value={cad(metrics.annualOperatingProfit)}
        />
        <MetricCard label="ROI" value={`${(metrics.roi * 100).toFixed(1)}%`} />
        <MetricCard label="Payback" value={payback} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {metrics.disclaimer ??
          "All predicted metrics are simulation estimates and not real financial data."}
      </p>
    </div>
  );
}
