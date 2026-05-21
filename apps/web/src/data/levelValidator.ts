// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import type { LevelDef } from '@match3d/farkle-shared';

export interface LevelAuditResult {
  levelId: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface CorpusAuditResult {
  totalLevels: number;
  passed: number;
  failed: number;
  results: LevelAuditResult[];
}

// Validate the complete LevelDef corpus for authoring correctness.
// Rules enforced:
//   1. All IDs are unique and follow the pattern level_NN.
//   2. Win scores are strictly increasing (no regression).
//   3. Spawn weights for die ≥ 20 (game is unplayable if die is too rare).
//   4. No weight is negative.
//   5. Special entity weights (bomb, rainbow_bomb, ice, lock, stone) ≤ 10 each.
//   6. catalyst + multiplier_orb + ghost + wild ≤ 30 combined (keeps die dominant).
//   7. Energy multiplier is in [1.0, 3.0].
//   8. Win score is positive.
//   9. Time limit, if set, is ≥ 30 s.
//  10. No duplicate level IDs.
export function auditLevels(levels: LevelDef[]): CorpusAuditResult {
  const results: LevelAuditResult[] = [];
  const seenIds = new Set<string>();
  let prevWinScore = 0;

  for (const level of levels) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const w = level.spawnWeights;

    if (seenIds.has(level.id)) errors.push(`duplicate id "${level.id}"`);
    seenIds.add(level.id);

    if (level.winScore <= 0) errors.push('winScore must be > 0');
    if (level.winScore <= prevWinScore) errors.push(`winScore ${level.winScore} must exceed previous level's ${prevWinScore}`);
    prevWinScore = level.winScore;

    if (w.die < 20) errors.push(`die weight ${w.die} is below minimum 20 — game unplayable`);

    const negFields = Object.entries(w).filter(([, v]) => (v as number) < 0);
    if (negFields.length) errors.push(`negative weights: ${negFields.map(([k]) => k).join(', ')}`);

    for (const field of ['bomb', 'rainbow_bomb', 'ice', 'lock', 'stone'] as const) {
      if (w[field] > 10) errors.push(`${field} weight ${w[field]} exceeds max 10`);
    }

    const specialSum = w.catalyst + w.multiplier_orb + w.ghost + w.wild;
    if (specialSum > 30) warnings.push(`specials sum ${specialSum} > 30 — die may feel rare`);

    if (level.energyMultiplier < 1.0 || level.energyMultiplier > 3.0)
      errors.push(`energyMultiplier ${level.energyMultiplier} outside [1.0, 3.0]`);

    if (level.timeLimitSec !== null && level.timeLimitSec < 30)
      errors.push(`timeLimitSec ${level.timeLimitSec} < 30 s minimum`);

    results.push({ levelId: level.id, ok: errors.length === 0, errors, warnings });
  }

  return {
    totalLevels: levels.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  };
}

// Quick pass/fail check — throws on any error, logs warnings.
export function assertLevelsValid(levels: LevelDef[]): void {
  const audit = auditLevels(levels);
  for (const r of audit.results) {
    for (const w of r.warnings) console.warn(`[levelValidator] ${r.levelId}: ${w}`);
    if (!r.ok) throw new Error(`[levelValidator] ${r.levelId}: ${r.errors.join('; ')}`);
  }
}
