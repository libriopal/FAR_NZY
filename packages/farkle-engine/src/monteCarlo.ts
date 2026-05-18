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

// Find the best-scoring subset of dice using exhaustive 2^n search.
// This mirrors real Farkle greedy-optimal play: score the highest-value
// subset and re-roll the rest. Prevents the false 100% farkle rate that
// occurs when all 6 dice are passed to lookupScore as a single chain.
function bestSubsetScore(faces: DieFace[], table: Int32Array): { score: number; kept: number } {
  const n = faces.length;
  let best = 0;
  let bestKept = 0;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = faces.filter((_, i) => (mask >> i) & 1);
    const s = lookupScore(subset, table);
    if (s > best) { best = s; bestKept = subset.length; }
  }
  return { score: best, kept: bestKept };
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
      let diceLeft = 6;
      let turnScore = 0;
      let farkled = false;

      // Simulate one full turn: roll, keep best subset, re-roll rest.
      // Hot dice: if all 6 scored, re-roll all 6 again.
      while (diceLeft > 0) {
        const roll = Array.from({ length: diceLeft }, () => (Math.floor(rng() * 6) + 1) as DieFace);
        const { score: s, kept } = bestSubsetScore(roll, table);
        if (s === 0) { farkled = true; break; }
        turnScore += s;
        diceLeft -= kept;
        if (diceLeft === 0) diceLeft = 6; // hot dice: re-roll all
        if (turnScore >= 500) break;      // greedy bank threshold
      }

      if (farkled) {
        totalFarkles++;
        break;
      }
      score += turnScore;
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
