// Threshold calibration sweep for playerContinue OPTIMAL model (ADR-022).
// Tests (stepLimit, unbankLimit) pairs to find OPTIMAL > AVERAGE > WEAK strict ordering.
// Self-contained simulation using the engine's own CSPRNG and scorer — does NOT modify monteCarlo.ts.

import { seededRng } from '@match3d/farkle-engine/csprng';
import { buildScoreTable, lookupScore } from '@match3d/farkle-engine/chainIndex';
import { MULTIPLIER_LADDER } from '@match3d/farkle-shared';

type DieFace = 1 | 2 | 3 | 4 | 5 | 6;
type PlayerModel = 'OPTIMAL' | 'AVERAGE' | 'WEAK';

const SESSIONS  = 5_000;
const MAX_TURNS = 30;
const SEED      = 42;
const table     = buildScoreTable();

function runModel(stepLimit: number, unbankLimit: number, model: PlayerModel): number {
  const masterRng = seededRng(SEED);
  let total = 0;

  for (let i = 0; i < SESSIONS; i++) {
    const sessionSeed  = Math.floor(masterRng() * 0x7FFF_FFFF);
    const diceRng      = seededRng(sessionSeed ^ 0xAA_BB_CC);
    const decisionRng  = seededRng(sessionSeed ^ 0x77_88_99);

    let banked         = 0;
    let unbanked       = 0;
    let multiplierStep = 0;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const roll: DieFace[] = [
        (Math.floor(diceRng() * 6) + 1) as DieFace,
        (Math.floor(diceRng() * 6) + 1) as DieFace,
        (Math.floor(diceRng() * 6) + 1) as DieFace,
        (Math.floor(diceRng() * 6) + 1) as DieFace,
        (Math.floor(diceRng() * 6) + 1) as DieFace,
        (Math.floor(diceRng() * 6) + 1) as DieFace,
      ];

      const rawScore = lookupScore(roll, table);

      if (rawScore === 0) {
        unbanked       = 0;
        multiplierStep = 0;
        continue;
      }

      const mult        = MULTIPLIER_LADDER[multiplierStep] ?? 1.0;
      const scaledScore = Math.round(rawScore * mult);

      // Mirror monteCarlo.ts playerContinue logic (ADR-022 Option A): OPTIMAL stochastic, WEAK deterministic.
      const optimal = multiplierStep < stepLimit && unbanked < unbankLimit;
      let cont: boolean;
      switch (model) {
        case 'OPTIMAL': cont = decisionRng() < 0.40 ? optimal : decisionRng() < 0.30; break;
        case 'AVERAGE': cont = decisionRng() < 0.70 ? optimal : decisionRng() < 0.50; break;
        default:        cont = optimal; break;
      }

      if (cont) {
        unbanked      += scaledScore;
        multiplierStep = Math.min(multiplierStep + 1, 5);
      } else {
        // Bank path mirrors monteCarlo.ts lines 501-506
        unbanked      += scaledScore;
        banked        += unbanked;
        unbanked       = 0;
        multiplierStep = 0;
        if (banked >= 100_000) break;
      }
    }

    total += banked;
  }

  return total / SESSIONS;
}

const stepLimits   = [2, 3, 4, 5];
const unbankLimits = [100, 200, 300, 500, 800, 1_200, 2_000, 4_054];

console.log(`\nPlayerContinue threshold sweep — ${SESSIONS} sessions, seed=${SEED}\n`);
console.log('stepLim  unbankLim    OPT     AVG    WEAK   Gate3');
console.log('-------  ---------  -----   -----   -----  -----');

const winners: Array<{ stepLimit: number; unbankLimit: number; opt: number; avg: number; wk: number }> = [];

for (const stepLimit of stepLimits) {
  for (const unbankLimit of unbankLimits) {
    const opt = runModel(stepLimit, unbankLimit, 'OPTIMAL');
    const avg = runModel(stepLimit, unbankLimit, 'AVERAGE');
    const wk  = runModel(stepLimit, unbankLimit, 'WEAK');
    const pass = opt > avg && avg > wk;
    const tag  = pass ? '✅ PASS' : '❌';
    console.log(
      `${String(stepLimit).padStart(7)}  ${String(unbankLimit).padStart(9)}  ` +
      `${opt.toFixed(0).padStart(5)}   ${avg.toFixed(0).padStart(5)}   ${wk.toFixed(0).padStart(5)}  ${tag}`
    );
    if (pass) winners.push({ stepLimit, unbankLimit, opt, avg, wk });
  }
}

if (winners.length === 0) {
  console.log('\n⚠  No passing threshold found — deeper model redesign required. Return to Human.');
} else {
  console.log(`\n${winners.length} passing threshold(s) found:`);
  for (const w of winners) {
    console.log(`  step < ${w.stepLimit} && unbanked < ${w.unbankLimit}  →  OPT=${w.opt.toFixed(0)} AVG=${w.avg.toFixed(0)} WEAK=${w.wk.toFixed(0)}`);
  }
  const best = winners[0]!;
  console.log(`\nRecommended (first passing): step < ${best.stepLimit} && unbanked < ${best.unbankLimit}`);
}

// ─── Option A verification: swap OPTIMAL ↔ WEAK case bodies ─────────────────
// OPTIMAL becomes the random/aggressive model (was WEAK); WEAK becomes deterministic conservative.
// Threshold kept at step<3 && unbanked<300 (serves as the WEAK conservative baseline).
console.log('\n\n─── Option A: Swap OPTIMAL/WEAK model definitions (ADR-022) ───');
console.log(`Sessions: ${SESSIONS}, seed: ${SEED}, threshold: step<3 && unbanked<300`);

function runModelOptionA(model: PlayerModel): number {
  const masterRng = seededRng(SEED);
  let total = 0;
  for (let i = 0; i < SESSIONS; i++) {
    const sessionSeed  = Math.floor(masterRng() * 0x7FFF_FFFF);
    const diceRng      = seededRng(sessionSeed ^ 0xAA_BB_CC);
    const decisionRng  = seededRng(sessionSeed ^ 0x77_88_99);
    let banked = 0, unbanked = 0, multiplierStep = 0;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const roll: DieFace[] = [1,2,3,4,5,6].map(() => (Math.floor(diceRng() * 6) + 1) as DieFace) as [DieFace,DieFace,DieFace,DieFace,DieFace,DieFace];
      const rawScore = lookupScore(roll, table);
      if (rawScore === 0) { unbanked = 0; multiplierStep = 0; continue; }
      const mult = MULTIPLIER_LADDER[multiplierStep] ?? 1.0;
      const scaledScore = Math.round(rawScore * mult);
      const optimal = multiplierStep < 3 && unbanked < 300;
      let cont: boolean;
      switch (model) {
        // Option A: OPTIMAL uses the old WEAK random/aggressive profile
        case 'OPTIMAL': cont = decisionRng() < 0.40 ? optimal : decisionRng() < 0.30; break;
        // AVERAGE: unchanged
        case 'AVERAGE': cont = decisionRng() < 0.70 ? optimal : decisionRng() < 0.50; break;
        // Option A: WEAK uses the old OPTIMAL deterministic conservative profile
        default:        cont = optimal; break;
      }
      if (cont) {
        unbanked += scaledScore;
        multiplierStep = Math.min(multiplierStep + 1, 5);
      } else {
        unbanked += scaledScore;
        banked   += unbanked;
        unbanked  = 0;
        multiplierStep = 0;
        if (banked >= 100_000) break;
      }
    }
    total += banked;
  }
  return total / SESSIONS;
}

const optA = runModelOptionA('OPTIMAL');
const avgA = runModelOptionA('AVERAGE');
const wkA  = runModelOptionA('WEAK');
const passA = optA > avgA && avgA > wkA;
console.log(`\nOPTIMAL = ${optA.toFixed(0)}  AVERAGE = ${avgA.toFixed(0)}  WEAK = ${wkA.toFixed(0)}`);
console.log(`Gate 3: ${passA ? '✅ PASS — OPTIMAL > AVERAGE > WEAK' : '❌ FAIL'}`);
if (passA) {
  console.log(`Skill gap (OPT-WEAK): ${(optA - wkA).toFixed(0)} pts`);
}
