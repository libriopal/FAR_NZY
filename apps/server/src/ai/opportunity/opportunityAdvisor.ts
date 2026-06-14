// Tier 2 — scaffold only.
// Runtime Cohere integration begins here when Tier 3 retrieval is ready.
//
// IMPORTANT: All calls through this advisor MUST use SpendCategory.OPPORTUNITY_ENGINE.
// This category has an isolated $150 ceiling. It may NOT consume from:
//   GOVERNANCE, MONTE_CARLO, QUEST_GENERATION, or RETRIEVAL budgets.
//
// The Opportunity Engine will be the FIRST consumer of Tier 3 retrieval.
// Once embeddings exist, this stub becomes a retrieval-augmented recommendation engine.

import type { PlayerOpportunityContext, OpportunityRecommendation } from './opportunitySchemas.js';

export async function analyzeOpportunities(
  _ctx: PlayerOpportunityContext
): Promise<OpportunityRecommendation> {
  // Deterministic default — returns static recommendations until Tier 2 is implemented.
  return {
    confidence: 0,
    reasoning: ['Opportunity Engine is Tier 2 — not yet implemented.'],
    opportunities: [],
  };
}
