import type { CostTable } from "@innsight/config";
import { SimulationError } from "./errors.js";
import type { HotelConfig, InvestmentMode } from "./types.js";

function amenityInstallCost(amenities: string[], costTable: CostTable): number {
  return amenities.reduce(
    (sum, amenity) => sum + (costTable.perAmenity[amenity] ?? 0),
    0,
  );
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
  const amenityCost = amenityInstallCost(input.amenities, costTable);
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
    const amenityUpgradeCost = amenityInstallCost(addedAmenities, costTable);

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
