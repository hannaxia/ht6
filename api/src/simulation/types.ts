export type HotelType =
  | "budget"
  | "midscale"
  | "upscale"
  | "luxury"
  | "resort"
  | "extended_stay";

export type LocationType =
  | "downtown"
  | "airport"
  | "resort"
  | "business_district"
  | "suburban";

export interface LocationScores {
  transit: number; // 0..1
  airport: number; // 0..1
  tourism: number; // 0..1
  business: number; // 0..1
}

export interface CompetitorHotel {
  stars?: number;
  hotelType?: HotelType;
  pricePerNight?: number; // USD
  coordinates: { lat: number; lng: number };
}

export interface HotelConfig {
  hotelType: HotelType;
  rooms: number; // non-negative integer
  stars: 1 | 2 | 3 | 4 | 5;
  modernity: number; // 0..1 (0 = needs renovation, 1 = brand new)
  renovationDelta: number; // 0..1 renovation intended (CapEx only)
  amenities: string[];
  targetSegment: "leisure" | "business" | "mixed";
  basePrice: number; // USD, from city context
  segmentAdrNorm: number; // USD, segment-normal ADR from city context
  location: {
    type: LocationType;
    scores: LocationScores;
    coordinates: { lat: number; lng: number };
    baseDemand: number; // pp, city-average baseline occupancy
    locationDemand: number; // pp delta
    locationSatisfaction: number; // rating points delta
  };
  competitors: CompetitorHotel[];
  baseRating: number; // typically 3.5
}

export interface SimulateHotelOutput {
  adr: number; // > 0
  occupancy: number; // 0..100
  revenue: number; // >= 0
  rating: number; // 1.0..5.0
  investment: number; // >= 0
  annualOperatingProfit: number; // >= 0
  roi: number; // >= 0
  paybackYears: number; // > 0 or +Infinity
  intermediates: {
    locationMultiplier: number;
    qualityMultiplier: number;
    amenityImpactPct: number; // in [-cap, +cap]
    competitionPressure: number; // pp
    amenitySatisfaction: number; // rating points
    priceExpectationPenalty: number;
  };
  disclaimer: string;
}

export interface OpportunityCellContext {
  basePrice: number;
  segmentAdrNorm: number;
  location: HotelConfig["location"];
  volatility: number; // 0..1
  relConstructionCost: number; // ratio to city average, ~1
  demandConcentration: number; // 0..1
}

export interface OpportunityGridInput {
  city: string;
  gridSize: number;
  cityBbox: { north: number; south: number; east: number; west: number };
  competitors: CompetitorHotel[];
  cellContextResolver: (coord: {
    lat: number;
    lng: number;
  }) => OpportunityCellContext;
}

export interface OpportunityCell {
  coordinates: { lat: number; lng: number };
  components: {
    revenuePotential: number;
    demand: number;
    segmentWeightedCompetition: number;
    risk: number;
  };
  normalized: {
    revenuePotential: number;
    demand: number;
    segmentWeightedCompetition: number;
    risk: number;
  };
  opportunityScore: number; // 0..100
}
