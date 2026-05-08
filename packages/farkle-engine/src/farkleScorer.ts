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

import type { DieFace } from '@match3d/farkle-shared';
import { lookupScore, buildScoreTable } from './chainIndex.js';

// Lazy-initialized lookup table — built once, reused for all scoring calls.
// Uses exhaustive internalScoreFarkle (not greedy), so Two-Triplets [1,1,1,2,2,2]
// correctly returns 2500, not 1200. (PRESERVATION_SPEC W6 requirement)
let _table: Int32Array | null = null;
function getTable(): Int32Array {
  if (!_table) _table = buildScoreTable();
  return _table;
}

export interface FarkleResult {
  score: number;
  scaledScore: number;
  isFarkle: boolean;
  combo: string;
  triggersBomb: null | 'BOMB_STANDARD' | 'BOMB_RAINBOW';
}

export function scoreFarkle(
  faces: DieFace[],
  multiplier: number = 1
): FarkleResult {
  const table = getTable();
  const score = lookupScore(faces, table);
  const isFarkle = faces.length > 0 && score === 0;
  const combo = isFarkle ? 'Farkle' : describeCombo(faces, score);

  let triggersBomb: null | 'BOMB_STANDARD' | 'BOMB_RAINBOW' = null;
  if (!isFarkle && faces.length === 6) {
    if (combo === 'Six of a Kind') triggersBomb = 'BOMB_STANDARD';
    else if (combo === 'Straight') triggersBomb = 'BOMB_RAINBOW';
  }

  return {
    score,
    scaledScore: Math.round(score * multiplier),
    isFarkle,
    combo,
    triggersBomb,
  };
}

function describeCombo(faces: DieFace[], score: number): string {
  if (faces.length === 0) return '';
  const counts = Array(7).fill(0) as number[];
  for (const f of faces) counts[f] = (counts[f] ?? 0) + 1;

  if (faces.length === 6) {
    if (counts.slice(1).every(c => c === 1)) return 'Straight';
    if (counts.some(c => c === 6)) return 'Six of a Kind';
    if (counts.filter(c => c === 3).length === 2) return 'Two Triplets';
    if (counts.filter(c => c === 2).length === 3) return 'Three Pairs';
    if (counts.some(c => c === 4) && counts.some(c => c === 2)) return '4+Pair';
    if (counts.some(c => c === 5)) return 'Five of a Kind';
  }

  const parts: string[] = [];
  for (let f = 1; f <= 6; f++) {
    const c = counts[f] ?? 0;
    if (c === 5) { parts.push(`Five ${f}s`); continue; }
    if (c === 4) { parts.push(`Four ${f}s`); continue; }
    if (c === 3) { parts.push(f === 1 ? 'Three 1s' : `Three ${f}s`); continue; }
    if (c >= 1 && (f === 1 || f === 5)) {
      parts.push(c === 1 ? String(f) : `${c}×${f}`);
    }
  }
  return parts.join(' + ') || `${score}pts`;
}
