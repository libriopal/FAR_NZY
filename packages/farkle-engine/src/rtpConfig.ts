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

import type { GameMode, RTPConfig } from '@match3d/farkle-shared';
import { RALLY_MILESTONES } from '@match3d/farkle-shared';

export const RTP_CONFIGS: Record<GameMode, RTPConfig> = {
  SOLO_FREE:    { mode: 'SOLO_FREE',    targetRTP: 0.92, platformFee: 0.00, poolSize: 60,
                  varianceTarget: 'MEDIUM' },
  SOLO_CASINO:  { mode: 'SOLO_CASINO',  targetRTP: 0.92, platformFee: 0.00, poolSize: 60,
                  varianceTarget: 'MEDIUM',
                  bonusSpawnRates: { multiplierOrb: 0.04, bomb: 0.01, rainbowBomb: 0.00 } },
  VS_FREE:      { mode: 'VS_FREE',      targetRTP: 1.00, platformFee: 0.00, poolSize: 66,
                  varianceTarget: 'LOW' },
  VS_CASINO:    { mode: 'VS_CASINO',    targetRTP: 1.00, platformFee: 0.08, poolSize: 66,
                  varianceTarget: 'LOW',
                  bonusSpawnRates: { multiplierOrb: 0.04, bomb: 0.01, rainbowBomb: 0.00 } },
  RALLY_FREE:   { mode: 'RALLY_FREE',   targetRTP: 0.92, platformFee: 0.00, poolSize: 66,
                  varianceTarget: 'HIGH' },
  RALLY_CASINO: { mode: 'RALLY_CASINO', targetRTP: 0.92, platformFee: 0.08, poolSize: 66,
                  varianceTarget: 'HIGH',
                  bonusSpawnRates: { multiplierOrb: 0.05, bomb: 0.04, rainbowBomb: 0.01 },
                  milestoneConfig: RALLY_MILESTONES },
  HEIST_FREE:   { mode: 'HEIST_FREE',   targetRTP: 0.92, platformFee: 0.00, poolSize: 66,
                  varianceTarget: 'HIGH' },
  HEIST_CASINO: { mode: 'HEIST_CASINO', targetRTP: 0.92, platformFee: 0.08, poolSize: 66,
                  varianceTarget: 'HIGH',
                  bonusSpawnRates: { multiplierOrb: 0.05, bomb: 0.04, rainbowBomb: 0.01 } },
};

export function getPoolSize(playerCount: number): number {
  if (playerCount === 1) return 60;
  const size = 6 + playerCount;
  return Math.ceil((size * size) / 6) * 6;
}
