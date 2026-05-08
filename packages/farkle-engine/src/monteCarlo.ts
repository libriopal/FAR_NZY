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

import type { GameMode, DieFace } from '@match3d/farkle-shared';
import { seededRng } from './csprng.js';
import { RTP_CONFIGS } from './rtpConfig.js';
import { lookupScore, buildScoreTable } from './chainIndex.js';

export interface MonteCarloResult {
  averageScore: number;
  farkleRate: number;
  normalizer: number;
  sessionsRun: number;
}

// Lazy-initialized table — uses the same max-partition scorer as the live game (W6 compliance).
let _mcTable: Int32Array | null = null;
function getMcTable(): Int32Array {
  if (!_mcTable) _mcTable = buildScoreTable();
  return _mcTable;
}

export function calibrateNormalizer(
  mode: GameMode,
  sessions: number = 4000
): MonteCarloResult {
  const table = getMcTable();
  let totalScore = 0;
  let totalFarkles = 0;

  for (let i = 0; i < sessions; i++) {
    let score = 0;
    let chainCount = 0;
    const rng = seededRng(i);

    while (score < 50000 && chainCount < 30) {
      const roll = Array.from({ length: 6 }, () => (Math.floor(rng() * 6) + 1) as DieFace);
      const chainScore = lookupScore(roll, table);
      if (chainScore === 0) {
        totalFarkles++;
        break;
      }
      score += chainScore;
      chainCount++;
    }

    totalScore += score;
  }

  const averageScore = totalScore / sessions;
  const farkleRate = totalFarkles / sessions;
  const normalizer = averageScore / RTP_CONFIGS[mode].targetRTP;

  return {
    averageScore,
    farkleRate,
    normalizer,
    sessionsRun: sessions,
  };
}

export function runMonteCarlo(mode: GameMode, sessions: number = 4000): MonteCarloResult {
  return calibrateNormalizer(mode, sessions);
}
