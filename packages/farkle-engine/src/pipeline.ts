// ═══════════════════════════════════════════════════════════════════════════
// pipeline.ts — POST-SCORE MULTIPLIER LAYER  (L3 Mode Overlay)
// ═══════════════════════════════════════════════════════════════════════════
//
// POSITION IN GAME LOOP:
//   farkleScorer.ts (raw dice score)
//     └─▶  pipeline.ts (apply streak / combo modifiers)   ◀── YOU ARE HERE
//             └─▶  gameRoom.ts (add to unbanked, check win condition)
//
// WHAT THIS MODULE DOES:
//   Two post-scoring mechanics layered on top of the Sacred Core scorer:
//
//   1. EVENT HORIZON  (§9.4 of newmodespec)
//      Rewards consecutive successful banks with a streak multiplier.
//      Streak resets to 0 on any real farkle (not token-absorbed).
//      Multiplier = MAX(eventMult, ladderMult) — never compounds both.
//      This keeps RTP stable: on COLD streaks the ladder still applies.
//
//      Streak thresholds:
//        COLD   0–2 banks  → ×1.0  (no bonus)
//        WARM   3–4 banks  → ×1.25
//        HOT    5–7 banks  → ×1.5
//        FRENZY ≥8  banks  → ×2.0
//
//   2. COMBO BREAKER  (§9.5 of newmodespec)
//      Each player starts with 1 token. On the FIRST farkle the token
//      auto-spends, reverting the farkle: no score loss, turn continues.
//      Additional tokens earned when a bank yields ≥ EVENT_HORIZON_EARN_THRESHOLD.
//      Hard cap of MAX_TOKENS=5 to prevent accumulation exploits.
//
// FAIRNESS NOTE:
//   applyEventHorizon takes MAX(eventMult, ladder), never a product. This means
//   the Event Horizon replaces the ladder multiplier at high streaks rather
//   than stacking on top of it. RTP impact is bounded and testable via
//   the Monte Carlo harness in monteCarlo.ts.
//
// AUDITOR CHECKLIST:
//   ✔ No global mutable state — all functions are pure
//   ✔ Streak is per-player, stored in gameRoom.playerEventHorizonStreaks
//   ✔ Token balance is per-player, stored in gameRoom.playerTokens
//   ✔ Both are reset on START_GAME; streaks reset on real farkle
// ═══════════════════════════════════════════════════════════════════════════

// Streak tiers — maps consecutive-bank count to a named heat level
export type EventHorizonLevel = 'COLD' | 'WARM' | 'HOT' | 'FRENZY';

// Returns the current heat level for a given consecutive-bank streak
export function getEventHorizonLevel(streak: number): EventHorizonLevel {
  if (streak >= 8) return 'FRENZY';
  if (streak >= 5) return 'HOT';
  if (streak >= 3) return 'WARM';
  return 'COLD';
}

// Raw multiplier table — used by applyEventHorizon below
const EVENT_HORIZON_MULTIPLIERS: Record<EventHorizonLevel, number> = {
  COLD: 1.0, WARM: 1.25, HOT: 1.5, FRENZY: 2.0,
};

// Apply post-score multiplier: MAX(eventMult, ladderMult) — never compound.
// Called in gameRoom.processChain after scoreFarkle, before adding to unbanked.
export function applyEventHorizon(rawScore: number, streak: number, ladderMultiplier: number): number {
  const eventMult = EVENT_HORIZON_MULTIPLIERS[getEventHorizonLevel(streak)];
  return Math.round(rawScore * Math.max(eventMult, ladderMultiplier));
}

// Combo Breaker token resolution — called at the top of processChain farkle path.
// If isFarkle=true AND tokens>0: absorb the farkle (no penalty, token -1).
// If isFarkle=false OR tokens=0: pass through unchanged.
export function resolveComboBreaker(
  isFarkle: boolean,
  tokens: number,
): { isFarkle: boolean; tokenConsumed: boolean } {
  if (isFarkle && tokens > 0) return { isFarkle: false, tokenConsumed: true };
  return { isFarkle, tokenConsumed: false };
}

// Minimum bank gain required to earn a Combo Breaker token
export const EVENT_HORIZON_EARN_THRESHOLD = 500;

// Maximum tokens any player can hold simultaneously (anti-exploit cap)
export const MAX_TOKENS = 5;
