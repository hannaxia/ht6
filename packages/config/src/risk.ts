/** Weights for the Opportunity Score risk component. */
// placeholder — tune later
export const riskWeights = {
  volatility: 0.5,
  relConstructionCost: 0.3,
  demandConcentration: 0.2,
};

export type RiskWeights = typeof riskWeights;
