// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Legal skill-predominance analytics. Pure computation only.
// No side effects. No imports from apps/.
// ─────────────────────────────────────────────────────

export interface SessionAnalytics {
  id: string;
  player_id: string;
  mode: string;
  seed_hash: string;
  started_at: string;
  ended_at: string | null;
  total_chains: number;
  scoring_chains: number;
  farkle_count: number;
  banks_taken: number;
  peak_multiplier: number;
  final_banked: number;
  final_score: number;
  avg_chain_score: number;
  skill_score: number;
}

export interface ChainDecision {
  id: string;
  session_id: string;
  player_id: string;
  chain_number: number;
  faces_played: number[];
  score_result: number;
  multiplier_at: number;
  unbanked_before: number;
  decision: 'CONTINUE' | 'BANK' | 'PASS' | 'FARKLE';
  was_optimal: boolean;
  timestamp: string;
}

export interface DecisionContext {
  decision: 'BANK' | 'CONTINUE' | 'PASS';
  unbanked: number;
  multiplierStep: number;
  chainNumber: number;
}

const MULTIPLIER_STEPS: readonly number[] = [1.0, 1.25, 1.5, 2.0, 3.0, 4.0];
const WIN_SCORE = 100_000;

// Weights: chainQuality 40%, bankEfficiency 35%, farkleResistance 25%.
// Expert players return > 0.65. Random play returns 0.30-0.40.
export function computeSkillScore(session: Omit<SessionAnalytics, 'skill_score'>): number {
  if (session.total_chains === 0) return 0;

  const chainQuality = session.scoring_chains / session.total_chains;

  const expectedChains = Math.max(1, session.total_chains);
  const bankEfficiency = Math.min(1, session.avg_chain_score / (WIN_SCORE / expectedChains));

  const farkleRate = session.farkle_count / session.total_chains;
  const farkleResistance = Math.max(0, 1 - farkleRate * 2);

  return Math.max(0, Math.min(1,
    chainQuality * 0.40 + bankEfficiency * 0.35 + farkleResistance * 0.25,
  ));
}

// CONTINUE is optimal when expectedContinueValue > bankValue.
// expectedContinueValue = unbanked * (1 - farkleRisk) * nextMultiplierRatio
export function isOptimalDecision(
  decision: 'BANK' | 'CONTINUE',
  unbanked: number,
  multiplierStep: number,
  estimatedFarkleRisk: number,
): boolean {
  const bankValue = unbanked;
  const currentMult = MULTIPLIER_STEPS[Math.min(multiplierStep, 5)] ?? 4.0;
  const nextMult    = MULTIPLIER_STEPS[Math.min(multiplierStep + 1, 5)] ?? 4.0;
  const multiplierGain = nextMult / currentMult;
  const expectedContinueValue = unbanked * (1 - estimatedFarkleRisk) * multiplierGain;

  return decision === 'CONTINUE'
    ? expectedContinueValue > bankValue
    : bankValue >= expectedContinueValue;
}

// Baseline random risk ~0.37. Fewer scoring tiles (1s/5s) = higher risk.
export function estimateFarkleRisk(
  face1Count: number,
  face5Count: number,
  totalRemaining: number,
): number {
  if (totalRemaining === 0) return 1.0;
  const scoringRatio = (face1Count + face5Count) / totalRemaining;
  return Math.max(0, Math.min(1, 0.85 - scoringRatio * 1.2));
}
