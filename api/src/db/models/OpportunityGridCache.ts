import { Schema, type Model, type Types } from "mongoose";

/**
 * Caches a fully-computed opportunity grid (nationwide or per-city) so
 * repeated page loads don't recompute thousands of cells (and re-scan the
 * whole Hotels collection) on every request. Keyed by `scope` (e.g.
 * "nationwide", "toronto"). Invalidate by re-running the scrape job or
 * calling the cache-busting script — there's no automatic TTL expiry here
 * since the underlying hotel data only changes when explicitly re-scraped,
 * not on a fixed schedule.
 */
export interface OpportunityGridCacheDoc {
  _id: Types.ObjectId;
  scope: string;
  cells: unknown[]; // OpportunityCell[]; stored loosely to avoid schema drift
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const OpportunityGridCacheSchema = new Schema<OpportunityGridCacheDoc>(
  {
    scope: { type: String, required: true, unique: true, index: true },
    cells: { type: [Schema.Types.Mixed], required: true, default: [] },
    computedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export type OpportunityGridCacheModel = Model<OpportunityGridCacheDoc>;
