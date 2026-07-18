import type { CostTable } from "@innsight/config";
import { SimulationError } from "./errors.js";
import type { HotelConfig } from "./types.js";

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
): number {
  const perRoom = costTable.perRoom[input.hotelType][input.stars];
  const amenityCost = input.amenities.reduce(
    (sum, amenity) => sum + (costTable.perAmenity[amenity] ?? 0),
    0,
  );
  const renovation =
    costTable.renovationPerRoom * input.rooms * input.renovationDelta;
  const total = perRoom * input.rooms + amenityCost + renovation;
  if (!Number.isFinite(total) || total < 0) {
    throw new SimulationError("investment_invalid", { total, input: { ...input } });
  }
  return total;
}

export function roi(profit: number, investment: number): number {
  // 0/0 identity: nothing built, nothing spent (rooms=0, no amenities).
  if (investment === 0 && profit === 0) return 0;
  if (investment <= 0) {
    throw new SimulationError("investment_non_positive", { investment });
  }
  if (profit === 0) return 0;
  return profit / investment;
}

export function payback(profit: number, investment: number): number {
  if (investment === 0 && profit === 0) return Number.POSITIVE_INFINITY;
  if (investment <= 0) {
    throw new SimulationError("investment_non_positive", { investment });
  }
  if (profit === 0) return Number.POSITIVE_INFINITY;
  return investment / profit;
}
