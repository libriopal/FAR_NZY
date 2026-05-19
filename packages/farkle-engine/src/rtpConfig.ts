// ═══════════════════════════════════════════════════════
// FARKLE FRENZY — CORE SACRED FILE
// This file implements game balance, scoring, or fairness logic.
// DO NOT MODIFY without:
//   1. Running all 16 farkleScorer test cases
//   2. Running npx tsc --noEmit (must show 0 errors)
//   3. Explicit developer approval
//   4. Updating DECISIONS_LOCKED_v4.txt if any constant changes
// See .ff-core-lock for full classification manifest.
// ═══════════════════════════════════════════════════════

// ── RTP CONFIG — audit-compliant structured RTP ───────────────────────────────
// platformFee is REMOVED from all modes. House margin is expressed explicitly
// as (grossRTP - netRTP). Payout uses netRTP; Monte Carlo validates against targetRTP.
//
// grossRTP: theoretical return in a zero-house game (e.g. 1.00 = players get everything)
// netRTP:   actual return after house margin (= targetRTP for casino modes)
// margin:   grossRTP - netRTP (e.g. 0.08 for VS_CASINO — 8 cents per dollar wagered)
//
// VS_CASINO margin is now documented, not hidden in a fee field:
//   grossRTP 1.00 - netRTP 0.92 = 0.08 house margin (8%)
// RALLY/HEIST_CASINO margin: grossRTP 1.00 - netRTP 0.92 = 0.08 house margin
// SOLO_CASINO: no zero-sum dynamic; grossRTP = netRTP = 0.92 (player vs. house)

import type { GameMode, RTPConfig } from '@match3d/farkle-shared';

export const RTP_CONFIGS: Record<GameMode, RTPConfig> = {
  SOLO_FREE:    { mode: 'SOLO_FREE',    targetRTP: 0.92, grossRTP: 0.92, netRTP: 0.92, poolSize: 60 },
  SOLO_CASINO:  { mode: 'SOLO_CASINO',  targetRTP: 0.92, grossRTP: 0.92, netRTP: 0.92, poolSize: 60 },
  VS_FREE:      { mode: 'VS_FREE',      targetRTP: 1.00, grossRTP: 1.00, netRTP: 1.00, poolSize: 66 },
  VS_CASINO:    { mode: 'VS_CASINO',    targetRTP: 0.92, grossRTP: 1.00, netRTP: 0.92, poolSize: 66 },
  RALLY_FREE:   { mode: 'RALLY_FREE',   targetRTP: 0.92, grossRTP: 0.92, netRTP: 0.92, poolSize: 66 },
  RALLY_CASINO: { mode: 'RALLY_CASINO', targetRTP: 0.92, grossRTP: 1.00, netRTP: 0.92, poolSize: 66 },
  HEIST_FREE:   { mode: 'HEIST_FREE',   targetRTP: 0.92, grossRTP: 0.92, netRTP: 0.92, poolSize: 66 },
  HEIST_CASINO: { mode: 'HEIST_CASINO', targetRTP: 0.92, grossRTP: 1.00, netRTP: 0.92, poolSize: 66 },
};

export function getPoolSize(playerCount: number): number {
  if (playerCount === 1) return 60;
  const size = 6 + playerCount;
  return Math.ceil((size * size) / 6) * 6;
}
