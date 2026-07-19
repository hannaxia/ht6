/** USD construction/installation cost lookups. */
// placeholder — tune later
export const costTable = {
  /** USD per room, by hotel type × star level. */
  perRoom: {
    budget: { 1: 60_000, 2: 75_000, 3: 90_000, 4: 120_000, 5: 150_000 },
    midscale: { 1: 80_000, 2: 100_000, 3: 130_000, 4: 160_000, 5: 200_000 },
    upscale: { 1: 120_000, 2: 150_000, 3: 190_000, 4: 240_000, 5: 300_000 },
    luxury: { 1: 200_000, 2: 250_000, 3: 320_000, 4: 400_000, 5: 500_000 },
    resort: { 1: 150_000, 2: 200_000, 3: 260_000, 4: 340_000, 5: 450_000 },
    extended_stay: { 1: 70_000, 2: 90_000, 3: 110_000, 4: 140_000, 5: 180_000 },
  },
  /** USD one-time install cost per amenity. */
  perAmenity: {
    pool: 250_000,
    spa: 400_000,
    gym: 60_000,
    restaurant: 300_000,
    bar: 100_000,
    wifi: 15_000,
    parking: 200_000,
    breakfast: 40_000,
    ev_charging: 80_000,
    conference_rooms: 250_000,
    airport_shuttle: 90_000,
    pet_friendly: 20_000,
  } as Record<string, number>,
  /** USD per room for a full (renovationDelta = 1) renovation. */
  renovationPerRoom: 25_000,
};

export type CostTable = typeof costTable;
