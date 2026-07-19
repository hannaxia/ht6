import type { CostTable } from "@innsight/config";
import { SimulationError } from "./errors.js";
import type { HotelConfig, InvestmentMode } from "./types.js";

// base + perRoom × rooms per amenity — a 1-room listing and a 500-room hotel
// installing the same amenity (e.g. wifi) get very different costs, rather
// than the old flat per-amenity number that priced them identically. `rooms`
// is the hotel's current/final room count (the amenity has to serve however
// many rooms the hotel actually has now).
function amenityInstallCost(
  amenities: string[],
  costTable: CostTable,
  rooms: number,
): number {
  return amenities.reduce((sum, amenity) => {
    const cost = costTable.perAmenity[amenity];
    if (!cost) return sum;
    return sum + cost.base + cost.perRoom * rooms;
  }, 0);
}

/**
 * Investment = costPerRoom×rooms + Σ(perAmenityInstallCost)
 *            + renovationPerRoom×rooms×renovationDelta
 * Every cost value comes from the config cost table.
 */
export function investmentFormula(
  input: Pick<
    HotelConfig,
    "hotelType" | "stars" | "rooms" | "amenities" | "renovationDelta"
  >,
  costTable: CostTable,
  options?: {
    mode?: InvestmentMode;
    startingConfig?: Pick<
      HotelConfig,
      "hotelType" | "stars" | "rooms" | "amenities" | "renovationDelta"
    >;
  },
): number {
  const mode = options?.mode ?? "new_build";
  const perRoom = costTable.perRoom[input.hotelType][input.stars];
  const amenityCost = amenityInstallCost(input.amenities, costTable, input.rooms);
  let total =
    perRoom * input.rooms +
    amenityCost +
    costTable.renovationPerRoom * input.rooms * input.renovationDelta;

  if (mode === "upgrade" && options?.startingConfig) {
    const base = options.startingConfig;
    const basePerRoom = costTable.perRoom[base.hotelType][base.stars];
    const carriedRooms = Math.min(input.rooms, base.rooms);
    const addedRooms = Math.max(0, input.rooms - base.rooms);
    const qualityUpgradeCost = Math.max(0, perRoom - basePerRoom) * carriedRooms;
    const expansionCost = perRoom * addedRooms;

    const baseAmenities = new Set(base.amenities);
    const addedAmenities = input.amenities.filter((a) => !baseAmenities.has(a));
    const amenityUpgradeCost = amenityInstallCost(
      addedAmenities,
      costTable,
      input.rooms,
    );

    const renovationDeltaIncrease = Math.max(
      0,
      input.renovationDelta - base.renovationDelta,
    );
    const renovationUpgradeCost =
      costTable.renovationPerRoom * input.rooms * renovationDeltaIncrease;

    total =
      qualityUpgradeCost + expansionCost + amenityUpgradeCost + renovationUpgradeCost;
  }

  if (!Number.isFinite(total) || total < 0) {
    throw new SimulationError("investment_invalid", { total, input: { ...input } });
  }
  return total;
}

export function roi(profit: number, investment: number): number {
  // No capital deployed — either nothing built (new_build with rooms=0, no
  // amenities) or, in "upgrade" mode, no changes made yet (an existing
  // hotel's config still exactly matches its startingConfig, e.g. right
  // after loading it into the sandbox before any edit). Either way there's
  // no investment to compute a return on, so ROI is reported as 0 rather
  // than thrown — a real positive profit with $0 incremental investment
  // isn't a formula bug, it's the expected "haven't changed anything yet"
  // state, and shouldn't crash the whole simulation.
  if (investment <= 0) return 0;
  if (profit === 0) return 0;
  return profit / investment;
}

export function payback(profit: number, investment: number): number {
  // See roi()'s comment — $0 invested has no payback period; infinite reads
  // correctly in the UI (already rendered as "∞").
  if (investment <= 0) return Number.POSITIVE_INFINITY;
  if (profit === 0) return Number.POSITIVE_INFINITY;
  return investment / profit;
}
