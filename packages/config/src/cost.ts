/** USD construction/installation cost lookups. */
export const costTable = {
  // placeholder — tune later. (perAmenity below is researched — see its
  // own comment — this per-room-by-type/star table is not.)
  /** USD per room, by hotel type × star level. */
  perRoom: {
    budget: { 1: 60_000, 2: 75_000, 3: 90_000, 4: 120_000, 5: 150_000 },
    midscale: { 1: 80_000, 2: 100_000, 3: 130_000, 4: 160_000, 5: 200_000 },
    upscale: { 1: 120_000, 2: 150_000, 3: 190_000, 4: 240_000, 5: 300_000 },
    luxury: { 1: 200_000, 2: 250_000, 3: 320_000, 4: 400_000, 5: 500_000 },
    resort: { 1: 150_000, 2: 200_000, 3: 260_000, 4: 340_000, 5: 450_000 },
    extended_stay: { 1: 70_000, 2: 90_000, 3: 110_000, 4: 140_000, 5: 180_000 },
  },
  /**
   * USD one-time install cost per amenity = base + perRoom × rooms.
   *
   * A flat per-amenity number priced a 1-room Airbnb adding wifi the same
   * as a 150-room hotel adding wifi, which is wrong in both directions: a
   * shared facility (pool, spa, restaurant) costs roughly the same to build
   * regardless of room count (so it's mostly `base`, small `perRoom`), while
   * genuinely per-room infrastructure (wifi access points, parking stalls,
   * EV chargers, pet-friendly room prep) scales with how many rooms actually
   * need it (larger `perRoom`, small `base`).
   *
   * Every entry below is grounded in researched real-world cost ranges (web
   * search, mid-2026), not reverse-fit from the old flat placeholder table —
   * base ≈ the smallest realistic version of the amenity (a B&B-scale
   * install), and base + perRoom×150 ≈ a real mid-size (~150-room) hotel's
   * cost for that amenity. Some amenities (pool, spa, restaurant, conference
   * rooms, a dedicated shuttle van) don't really make sense at true 1-room
   * scale in reality — no B&B builds a $30K pool — but the linear model still
   * produces a defensible number there rather than a special case, and the
   * base cost is deliberately the cheapest realistic version of the amenity,
   * not a large property's cost divided down.
   */
  perAmenity: {
    // Commercial pool construction: ~$56-112/sqft small, $42-98/sqft medium.
    // base = a small "spool"/plunge pool (real $5.5K-50K range, low-mid).
    // ~150 rooms ≈ a ~1,500-2,000 sqft pool in the $105K-245K band.
    pool: { base: 30_000, perRoom: 650 },
    // Spa build-out: $200-500/sqft (3-star to 5-star tier). base = one small
    // treatment room at budget finish; ~150 rooms ≈ a real hotel spa
    // (~1,800 sqft at ~$220/sqft).
    spa: { base: 60_000, perRoom: 2_250 },
    // Hotel fitness equipment: ~$50-75/sqft of floor space. Research bands:
    // small property $15-35K, mid-size hotel $30-75K, large/resort
    // $75-200K+. base = a handful of home-gym-grade pieces.
    gym: { base: 8_000, perRoom: 280 },
    // Restaurant build-out: $250-500/sqft kitchen, $75-150K small takeout
    // tier, $175-750K full sit-down startup. base = a small breakfast/dining
    // nook + basic kitchenette (below full-restaurant tier).
    restaurant: { base: 70_000, perRoom: 2_200 },
    // Bar build-out: $10-50K small bar, $75-300K full construction. base = a
    // simple honesty/wet bar, not a staffed lounge.
    bar: { base: 12_000, perRoom: 800 },
    // Real consumer/prosumer router (~$150-300 street price; no
    // professional install needed at B&B scale) — base is a single router,
    // not a project-overhead fee. A larger hotel needs roughly 1 access
    // point per 8 rooms (~$500/AP) plus cabling (~$100-200/run) plus install
    // labor — perRoom approximates that slice. ~150 rooms lands ~$14.4K,
    // matching real quotes in that range.
    wifi: { base: 150, perRoom: 95 },
    // Surface lot: $1,500-3,000/stall with minimal site prep (up to
    // $900-3,500 broader range). base = minimal paving/striping for a
    // couple of spots; perRoom ≈ one stall per room.
    parking: { base: 8_000, perRoom: 1_800 },
    // Research found no hard commercial figures, but described it as
    // low-cost/minimal (a hand sink + commercial dishwasher + basic
    // storage/serving gear) — base = a basic continental setup (coffee
    // urns, small fridge, tables); perRoom scales toward a fuller hot
    // buffet operation for a larger hotel.
    breakfast: { base: 8_000, perRoom: 180 },
    // Level 2 commercial charger: $3.5K-15K per port fully installed
    // (hardware + labor + electrical). Not 1:1 with rooms — base covers the
    // first charger + panel work; perRoom assumes roughly 1 additional
    // charger per ~15 rooms as the property scales.
    ev_charging: { base: 8_000, perRoom: 400 },
    // No hard "conference room" figure, but hotel construction runs
    // $130-550/sqft and a large video-conference-grade room runs ~$165K.
    // base = a small meeting nook at standard commercial finish (~$200/sqft
    // × ~200 sqft); perRoom scales toward a larger/better-equipped room.
    conference_rooms: { base: 40_000, perRoom: 900 },
    // Shuttle van: $30-70K new (15-passenger vans ~$50K), plus $18-36K
    // startup costs (insurance, permits, booking tech). base = one van +
    // basic setup — mostly fixed, since most properties need just 1-2 vans
    // regardless of size; perRoom is small, covering added capacity only at
    // real scale.
    airport_shuttle: { base: 55_000, perRoom: 150 },
    // Not a construction cost — mostly policy, signage, waste stations, and
    // a per-room pet kit/deep-cleaning allowance. Deliberately the smallest
    // entry in this table.
    pet_friendly: { base: 1_000, perRoom: 40 },
  } as Record<string, { base: number; perRoom: number }>,
  /** USD per room for a full (renovationDelta = 1) renovation. */
  renovationPerRoom: 25_000,
};

export type CostTable = typeof costTable;
