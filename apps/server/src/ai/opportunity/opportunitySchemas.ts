export interface Opportunity {
  id:          string;
  type:        string;
  description: string;
  value:       number;
}

export interface OpportunityRecommendation {
  confidence:     number;          // 0–1
  reasoning:      string[];
  opportunities:  Opportunity[];
}

export interface OpportunityAnalysis {
  playerSegment:   string;
  riskLevel:       'low' | 'medium' | 'high';
  recommendations: string[];
}

// Future input — player state contract for Tier 2 runtime
export interface PlayerOpportunityContext {
  userId:          string;
  sessionCount:    number;
  avgScore:        number;
  lastFarkleRate:  number;
  currencyBalance: { goldCoins: number; sweepsCoins: number };
  recentModes:     string[];
}
