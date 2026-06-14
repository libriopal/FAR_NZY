// ─── Opportunity Weight Controller (OWC) ─────────────────────────────────────
// Computes dynamic spawn-weight adjustments per turn.
//
// INVARIANTS (must never be violated):
//  1. All adjustments are additive deltas — never absolute probabilities.
//  2. Net bias for any single face is clamped to [-0.20, +0.20].
//  3. OWC never modifies scoring logic — it only influences simulation inputs.
//  4. Slipstream (VS/Heist) is the only cross-player weight interaction.
//  5. No Math.random() — all RNG paths go through the caller's CSPRNG.

import type { GameMode } from '@match3d/farkle-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OWCInput {
  mode: GameMode;
  playerRank: number;       // 1 = leader (lowest), 2+ = trailing
  playerCount: number;      // total players in match
  turnsElapsed: number;     // turns completed this match
  currentRTP: number;       // running actual RTP (avgScore / normalizer)
  targetRTP: number;        // from rtpConfig for this mode
  sessionFarkleRate: number; // rolling per-turn farkle rate so far
}

export interface OWCOutput {
  spawnWeightAdjustments: SpawnWeights; // face_1..face_6 delta from base probability
  slipstreamFactor: number;             // trailing-player boost multiplier (1.0 = no boost)
  owcContributionRtp: number;           // estimated RTP contribution of OWC adjustments
  reason: string;                       // human-readable explanation of active adjustments
}

export interface SpawnWeights {
  face_1: number;
  face_2: number;
  face_3: number;
  face_4: number;
  face_5: number;
  face_6: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FACE_BIAS_CAP = 0.20;          // max delta per face (±20%)
const SLIPSTREAM_MAX = 0.12;         // max slipstream bias on face_1 for trailing player
const RTP_CORRECTION_GAIN = 0.15;    // how aggressively to correct RTP drift
const FARKLE_RATE_HIGH = 0.22;       // above this, reduce face_2/3/4/6 bias
const FARKLE_RATE_LOW  = 0.08;       // below this, increase non-scoring face bias

// Modes where Slipstream is active (per newmodespec.md §2, §4)
const SLIPSTREAM_MODES = new Set<GameMode>(['VS_FREE', 'VS_CASINO', 'HEIST_FREE', 'HEIST_CASINO']);
// Modes where cooperative balance (no Slipstream) applies
const COOPERATIVE_MODES = new Set<GameMode>(['RALLY_FREE', 'RALLY_CASINO']);

// ─── Core controller ─────────────────────────────────────────────────────────

export function computeWeights(input: OWCInput): OWCOutput {
  const weights: SpawnWeights = { face_1: 0, face_2: 0, face_3: 0, face_4: 0, face_5: 0, face_6: 0 };
  const reasons: string[] = [];
  let slipstreamFactor = 1.0;

  // ── 1. Slipstream (VS / Heist) ──────────────────────────────────────────
  // Trailing players get a positive bias on high-value faces (1s and 5s).
  // Leader gets zero adjustment. Scales with rank gap and match progress.
  if (SLIPSTREAM_MODES.has(input.mode) && input.playerCount > 1) {
    const trailingDepth = input.playerRank - 1;         // 0 for leader, ≥1 for trailing
    const matchProgress = Math.min(input.turnsElapsed / 20, 1.0); // ramps over first 20 turns
    const slipBoost = Math.min(trailingDepth * 0.04 * matchProgress, SLIPSTREAM_MAX);

    if (slipBoost > 0) {
      weights.face_1 = clamp(slipBoost, FACE_BIAS_CAP);
      weights.face_5 = clamp(slipBoost * 0.5, FACE_BIAS_CAP);
      slipstreamFactor = 1 + slipBoost;
      reasons.push(`SLIPSTREAM rank=${input.playerRank} boost=${(slipBoost * 100).toFixed(1)}%`);
    }
  }

  // ── 2. Cooperative balance (Rally) ──────────────────────────────────────
  // All players share pool; mild uniform upward bias when RTP is lagging.
  if (COOPERATIVE_MODES.has(input.mode)) {
    const rtpShortfall = input.targetRTP - input.currentRTP;
    if (rtpShortfall > 0.02) {
      const boost = clamp(rtpShortfall * RTP_CORRECTION_GAIN, FACE_BIAS_CAP);
      weights.face_1 = clamp(weights.face_1 + boost, FACE_BIAS_CAP);
      reasons.push(`RALLY_RTP_CORRECT shortfall=${(rtpShortfall * 100).toFixed(1)}% boost=${(boost * 100).toFixed(1)}%`);
    }
  }

  // ── 3. Global RTP drift correction (all modes) ──────────────────────────
  // If running RTP is meaningfully above target, apply a gentle downward
  // correction by reducing face_1/face_5 bias (high-value faces).
  const rtpDrift = input.currentRTP - input.targetRTP;
  if (Math.abs(rtpDrift) > 0.03 && input.turnsElapsed >= 5) {
    const correction = clamp(Math.abs(rtpDrift) * RTP_CORRECTION_GAIN * 0.5, 0.05);
    if (rtpDrift > 0) {
      // RTP running high — gently reduce face_1 bias
      weights.face_1 = clamp(weights.face_1 - correction, FACE_BIAS_CAP);
      reasons.push(`RTP_HIGH drift=+${(rtpDrift * 100).toFixed(1)}% correct=-${(correction * 100).toFixed(1)}%`);
    } else {
      // RTP running low — gently increase face_5 bias
      weights.face_5 = clamp(weights.face_5 + correction, FACE_BIAS_CAP);
      reasons.push(`RTP_LOW drift=${(rtpDrift * 100).toFixed(1)}% correct=+${(correction * 100).toFixed(1)}%`);
    }
  }

  // ── 4. Farkle rate stabiliser ────────────────────────────────────────────
  // If farkle rate is abnormally high, reduce non-scoring face presence
  // (makes the grid slightly easier). If too low, increase it (more challenge).
  if (input.sessionFarkleRate > FARKLE_RATE_HIGH) {
    const reduce = clamp((input.sessionFarkleRate - FARKLE_RATE_HIGH) * 0.3, 0.05);
    weights.face_2 = clamp(weights.face_2 - reduce, FACE_BIAS_CAP);
    weights.face_3 = clamp(weights.face_3 - reduce, FACE_BIAS_CAP);
    reasons.push(`FARKLE_HIGH rate=${(input.sessionFarkleRate * 100).toFixed(1)}% reduce_low_faces=${(reduce * 100).toFixed(1)}%`);
  } else if (input.sessionFarkleRate < FARKLE_RATE_LOW && input.turnsElapsed >= 5) {
    const increase = clamp((FARKLE_RATE_LOW - input.sessionFarkleRate) * 0.3, 0.05);
    weights.face_2 = clamp(weights.face_2 + increase, FACE_BIAS_CAP);
    reasons.push(`FARKLE_LOW rate=${(input.sessionFarkleRate * 100).toFixed(1)}% increase_low_faces=${(increase * 100).toFixed(1)}%`);
  }

  // ── Estimate OWC RTP contribution ────────────────────────────────────────
  // face_1 bias × 0.6 + face_5 bias × 0.3 ≈ high-value score delta fraction
  const owcContributionRtp = (weights.face_1 * 0.6 + weights.face_5 * 0.3) * input.targetRTP;

  return {
    spawnWeightAdjustments: weights,
    slipstreamFactor,
    owcContributionRtp: Number(owcContributionRtp.toFixed(4)),
    reason: reasons.length ? reasons.join('; ') : 'NO_ADJUSTMENT',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, cap: number): number {
  return Math.max(-cap, Math.min(cap, value));
}

// ─── Default export ───────────────────────────────────────────────────────────

export const owc = { computeWeights };
