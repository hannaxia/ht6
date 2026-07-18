import { EstimateLabel } from "../shared/EstimateLabel";

// The gradient stops mirror the heatmap-color ramp in DiscoverMap so the
// legend reads as the same scale the map uses.
const GRADIENT =
  "linear-gradient(to right, rgb(215,48,39), rgb(252,141,89), rgb(254,224,139), rgb(166,217,106), rgb(26,152,80))";

export function HeatmapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-700">
          Opportunity
        </span>
        <EstimateLabel />
      </div>
      <div
        className="h-2 w-40 rounded"
        style={{ backgroundImage: GRADIENT }}
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>Lower</span>
        <span>Higher</span>
      </div>
    </div>
  );
}
