// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Skill scoring algorithm + shared analytics types.
// Consumed by analytics.ts — never touches Sacred Core.
// ─────────────────────────────────────────────────────

export interface SessionAnalytics {
  id?: string;
  player_id: string;
  mode: string;
  seed_hash: string;
  started_at?: string;
  ended_at?: string;
  total_chains: number;
  scoring_chains: number;
  farkle_count: number;
  banks_taken: number;
  peak_multiplier: number;
  final_banked: number;
  final_score: number;
  avg_chain_score: number;
  skill_score?: number;
  epoch_id?: string | null;
}

export interface ChainDecision {
  id?: string;
  session_id?: string;
  player_id: string;
  chain_number: number;
  faces_played: number[];
  score_result: number;
  multiplier_at: number;
  unbanked_before: number;
  decision: 'CONTINUE' | 'BANK' | 'PASS' | 'FARKLE';
  was_optimal: boolean;
  timestamp?: string;
}

/**
 * Composite skill score 0–100:
 *   40% — scoring efficiency (scoring_chains / total_chains)
 *   30% — farkle avoidance (inverse farkle rate)
 *   20% — multiplier exploitation (peak_multiplier / 4.0)
 *   10% — score volume (avg_chain_score normalised against 1000pt ceiling)
 */
export function computeSkillScore(session: Omit<SessionAnalytics, 'skill_score'>): number {
  const { total_chains, scoring_chains, farkle_count, peak_multiplier, avg_chain_score } = session;

  if (total_chains === 0) return 0;

  const efficiency   = scoring_chains / total_chains;                   // 0–1
  const farkleRate   = farkle_count   / total_chains;                   // 0–1
  const avoidance    = Math.max(0, 1 - farkleRate);                     // 0–1
  const multiplierEx = Math.min(1, (peak_multiplier - 1) / 3);         // 0–1 (1×→4×)
  const scoreVol     = Math.min(1, avg_chain_score / 1000);             // 0–1

  const raw = efficiency * 40 + avoidance * 30 + multiplierEx * 20 + scoreVol * 10;
  return Math.round(Math.min(100, Math.max(0, raw)));
}
