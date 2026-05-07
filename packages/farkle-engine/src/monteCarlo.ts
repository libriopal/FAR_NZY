import type { GameMode } from '@match3d/farkle-shared';
import { seededRng } from './csprng.js';
import { RTP_CONFIGS } from './rtpConfig.js';

export interface MonteCarloResult {
  averageScore: number;
  farkleRate: number;
  normalizer: number;
  sessionsRun: number;
}

export function calibrateNormalizer(
  mode: GameMode,
  sessions: number = 1000
): MonteCarloResult {
  let totalScore = 0;
  let totalFarkles = 0;

  for (let i = 0; i < sessions; i++) {
    let score = 0;
    let chainCount = 0;
    const rng = seededRng(i);

    while (score < 50000 && chainCount < 30) {
      const roll = Array(6).fill(0).map(() => Math.floor(rng() * 6) + 1);
      const result = scoreFarkleLocal(roll);
      if (result.isFarkle) {
        totalFarkles++;
        break;
      }
      score += result.score;
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

// Local scorer for Monte Carlo simulation (no external dependency on scorer module)
function scoreFarkleLocal(dice: number[]): { score: number; isFarkle: boolean } {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const die of dice) counts[die]++;

  let score = 0;
  let isFarkle = true;

  for (const [die, count] of Object.entries(counts)) {
    const dieScore = scoreDieFace(parseInt(die), count);
    if (dieScore > 0) {
      isFarkle = false;
      score += dieScore;
    }
  }

  return { score, isFarkle };
}

function scoreDieFace(face: number, count: number): number {
  if (count === 0) return 0;
  if (count === 5) return 2000;
  if (count === 4) return 1000;
  if (count === 3) return face === 1 ? 1000 : face * 100;
  if (count === 2) { if (face === 1) return 200; if (face === 5) return 100; }
  if (count === 1) { if (face === 1) return 100; if (face === 5) return 50; }
  return 0;
}

export function runMonteCarlo(mode: GameMode, sessions: number = 1000): MonteCarloResult {
  return calibrateNormalizer(mode, sessions);
}
