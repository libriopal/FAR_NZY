// ═══════════════════════════════════════════════════════════════════════════
// rhythm.ts — H: BEAT WINDOW / RHYTHM GENRE  (L4 Wrapper)
// ═══════════════════════════════════════════════════════════════════════════
//
// POSITION IN GAME LOOP:
//   pipeline.ts → applyEventHorizon → applyFacetToScore → applyFlowMultiplier
//
// WHAT THIS MODULE DOES:
//   Tracks a per-player "flow multiplier" that builds up as the player times
//   chain commits near the beat pulse.  Slipstream adjusts flowCap:
//     leader  (windowFactorQ=750) flowCapQ=1600  → tighter GOOD zone
//     default (windowFactorQ=1000) flowCapQ=2000  → standard
//     trailer (windowFactorQ=1500) flowCapQ=2000  → wider GOOD zone
//
//   Beat accuracy classification:
//     PERFECT  dist === 0 from perfectZone
//     GOOD     dist ≤ goodThreshold = Math.round(windowFactorQ × 3 / 2000)  (min 1)
//     MISS     otherwise → flow resets to 1000 (Q×1000: 1.0×)
//
// RTP NOTE:
//   Flow multiplier is capped by slipstream.flowCap and can never compound
//   with Event Horizon beyond RULE B (6× total).
// ═══════════════════════════════════════════════════════════════════════════

export type BeatAccuracy = 'PERFECT' | 'GOOD' | 'MISS';

export interface RhythmState {
  flowMultiplier: number;   // Q×1000 fixed-point integer: 1000 = 1.0×, 2000 = 2.0×
  consecutiveHits: number;  // PERFECT or GOOD streak (cosmetic display)
}

export const INITIAL_RHYTHM_STATE: RhythmState = {
  flowMultiplier: 1000,
  consecutiveHits: 0,
};

const PERFECT_GAIN = 150;         // Q×1000: 0.15 × 1000
const GOOD_GAIN    = 70;          // Q×1000: 0.07 × 1000
export const FLOW_BASE = 1000;    // Q×1000: 1.0×
export const FLOW_DEFAULT_CAP = 2000;  // Q×1000: 2.0×

// Number of beat markers in the UI bar (must match FarkleHUD BEAT_MARKERS=8)
export const BEAT_MARKERS = 8;
export const PERFECT_ZONE = Math.floor(BEAT_MARKERS / 2); // = 4

export function evaluateBeatAccuracy(beatPhase: number, windowFactorQ: number): BeatAccuracy {
  const dist = Math.abs(beatPhase - PERFECT_ZONE);
  if (dist === 0) return 'PERFECT';
  // windowFactorQ × 1.5 / 1000 = windowFactorQ × 3 / 2000
  const goodThreshold = Math.max(1, Math.round(windowFactorQ * 3 / 2000));
  return dist <= goodThreshold ? 'GOOD' : 'MISS';
}

export function applyFlowMultiplier(score: number, state: RhythmState, flowCapQ = FLOW_DEFAULT_CAP): number {
  const effQ = Math.min(state.flowMultiplier, flowCapQ);
  return Math.round(score * effQ / 1000);
}

export function tickRhythmAccuracy(
  state: RhythmState,
  accuracy: BeatAccuracy,
  flowCapQ = FLOW_DEFAULT_CAP,
): RhythmState {
  if (accuracy === 'PERFECT') {
    return {
      flowMultiplier: Math.min(flowCapQ, state.flowMultiplier + PERFECT_GAIN),
      consecutiveHits: state.consecutiveHits + 1,
    };
  }
  if (accuracy === 'GOOD') {
    return {
      flowMultiplier: Math.min(flowCapQ, state.flowMultiplier + GOOD_GAIN),
      consecutiveHits: state.consecutiveHits + 1,
    };
  }
  // MISS — reset
  return { flowMultiplier: FLOW_BASE, consecutiveHits: 0 };
}
