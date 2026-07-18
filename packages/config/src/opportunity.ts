/** Weighted-sum weights for the normalized Opportunity Score components. */
// placeholder — tune later
export const opportunityWeights = {
  revenuePotential: 0.35,
  demand: 0.35,
  segmentWeightedCompetition: 0.2,
  risk: 0.1,
};

export type OpportunityWeights = typeof opportunityWeights;
