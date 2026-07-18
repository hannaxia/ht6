import type { OpportunityCell } from "../../lib/api/schemas";
import { EstimateLabel } from "../shared/EstimateLabel";

export function HeatmapTooltip({ cell }: { cell: OpportunityCell }) {
  const rows: [string, number][] = [
    ["Opportunity", cell.opportunityScore],
    ["Revenue potential", cell.normalized.revenuePotential],
    ["Demand", cell.normalized.demand],
    ["Competition", cell.normalized.segmentWeightedCompetition],
    ["Risk", cell.normalized.risk],
  ];
  return (
    <div className="pointer-events-none rounded border border-slate-200 bg-white p-2 text-xs shadow">
      {rows.map(([label, value]) => (
        <p key={label} className="flex items-center gap-2 text-slate-700">
          <span className="w-32">{label}</span>
          <span className="font-mono">{value.toFixed(0)}</span>
          <EstimateLabel />
        </p>
      ))}
    </div>
  );
}
