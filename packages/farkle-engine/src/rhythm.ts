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
//     leader  (windowFactor=0.75) flowCap=1.6  → tighter GOOD zone
//     default (windowFactor=1.00) flowCap=2.0  → standard
//     trailer (windowFactor=1.50) flowCap=2.0  → wider GOOD zone
//
//   Beat accuracy classification:
//     PERFECT  dist === 0 from perfectZone
//     GOOD     dist ≤ goodThreshold = Math.round(windowFactor * 1.5)  (min 1)
//     MISS     otherwise → flow resets to 1.0
//
// RTP NOTE:
//   Flow multiplier is capped by slipstream.flowCap and can never compound
//   with Event Horizon beyond RULE B (6× total).
// ═══════════════════════════════════════════════════════════════════════════

export type BeatAccuracy = 'PERFECT' | 'GOOD' | 'MISS';

export interface RhythmState {
  flowMultiplier: number;   // 1.0 baseline → up to flowCap
  consecutiveHits: number;  // PERFECT or GOOD streak (cosmetic display)
}

export const INITIAL_RHYTHM_STATE: RhythmState = {
  flowMultiplier: 1.0,
  consecutiveHits: 0,
};

const PERFECT_GAIN = 0.15;
const GOOD_GAIN    = 0.07;
export const FLOW_BASE = 1.0;
export const FLOW_DEFAULT_CAP = 2.0;

// Number of beat markers in the UI bar (must match FarkleHUD BEAT_MARKERS=8)
export const BEAT_MARKERS = 8;
export const PERFECT_ZONE = Math.floor(BEAT_MARKERS / 2); // = 4

export function evaluateBeatAccuracy(beatPhase: number, windowFactor: number): BeatAccuracy {
  const dist = Math.abs(beatPhase - PERFECT_ZONE);
  if (dist === 0) return 'PERFECT';
  const goodThreshold = Math.max(1, Math.round(windowFactor * 1.5));
  return dist <= goodThreshold ? 'GOOD' : 'MISS';
}

export function applyFlowMultiplier(score: number, state: RhythmState, flowCap = FLOW_DEFAULT_CAP): number {
  const eff = Math.min(state.flowMultiplier, flowCap);
  return Math.round(score * eff);
}

export function tickRhythmAccuracy(
  state: RhythmState,
  accuracy: BeatAccuracy,
  flowCap = FLOW_DEFAULT_CAP,
): RhythmState {
  if (accuracy === 'PERFECT') {
    return {
      flowMultiplier: Math.min(flowCap, state.flowMultiplier + PERFECT_GAIN),
      consecutiveHits: state.consecutiveHits + 1,
    };
  }
  if (accuracy === 'GOOD') {
    return {
      flowMultiplier: Math.min(flowCap, state.flowMultiplier + GOOD_GAIN),
      consecutiveHits: state.consecutiveHits + 1,
    };
  }
  // MISS — reset
  return { flowMultiplier: FLOW_BASE, consecutiveHits: 0 };
}
