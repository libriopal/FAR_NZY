import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeWeights } from './index.js';
import type { OWCInput } from './index.js';

const FACE_BIAS_CAP = 0.20;

function base(overrides: Partial<OWCInput> = {}): OWCInput {
  return {
    mode: 'SOLO_FREE',
    playerRank: 1,
    playerCount: 1,
    turnsElapsed: 10,
    currentRTP: 0.92,
    targetRTP: 0.92,
    sessionFarkleRate: 0.14,
    ...overrides,
  };
}

// ── Slipstream ────────────────────────────────────────────────────────────────

test('slipstream: no adjustment for leader in VS mode', () => {
  const out = computeWeights(base({ mode: 'VS_FREE', playerRank: 1, playerCount: 2 }));
  assert.equal(out.spawnWeightAdjustments.face_1, 0);
  assert.equal(out.slipstreamFactor, 1.0);
});

test('slipstream: trailing player gets positive face_1 bias in VS mode', () => {
  const out = computeWeights(base({ mode: 'VS_FREE', playerRank: 2, playerCount: 2, turnsElapsed: 20 }));
  assert.ok(out.spawnWeightAdjustments.face_1 > 0, 'face_1 bias should be positive for trailing player');
  assert.ok(out.slipstreamFactor > 1.0, 'slipstreamFactor should exceed 1.0');
  assert.match(out.reason, /SLIPSTREAM/);
});

test('slipstream: not active in SOLO mode', () => {
  const out = computeWeights(base({ mode: 'SOLO_FREE', playerRank: 2, playerCount: 2, turnsElapsed: 20 }));
  assert.equal(out.spawnWeightAdjustments.face_1, 0);
  assert.equal(out.slipstreamFactor, 1.0);
});

// ── Cooperative balance (Rally) ───────────────────────────────────────────────

test('rally: upward bias when RTP is lagging', () => {
  const out = computeWeights(base({ mode: 'RALLY_FREE', currentRTP: 0.85, targetRTP: 0.92 }));
  assert.ok(out.spawnWeightAdjustments.face_1 > 0, 'face_1 should get boost when RTP lags in Rally');
  assert.match(out.reason, /RALLY_RTP_CORRECT/);
});

test('rally: no boost when RTP is on target', () => {
  const out = computeWeights(base({ mode: 'RALLY_FREE', currentRTP: 0.92, targetRTP: 0.92 }));
  assert.doesNotMatch(out.reason, /RALLY_RTP_CORRECT/);
});

// ── RTP drift correction ──────────────────────────────────────────────────────

test('rtp drift: reduces face_1 when running high', () => {
  const out = computeWeights(base({ currentRTP: 0.98, targetRTP: 0.92, turnsElapsed: 10 }));
  assert.ok(out.spawnWeightAdjustments.face_1 < 0, 'face_1 should be reduced when RTP drifts high');
  assert.match(out.reason, /RTP_HIGH/);
});

test('rtp drift: increases face_5 when running low', () => {
  const out = computeWeights(base({ currentRTP: 0.86, targetRTP: 0.92, turnsElapsed: 10 }));
  assert.ok(out.spawnWeightAdjustments.face_5 > 0, 'face_5 should increase when RTP drifts low');
  assert.match(out.reason, /RTP_LOW/);
});

test('rtp drift: no correction before 5 turns', () => {
  const out = computeWeights(base({ currentRTP: 0.86, targetRTP: 0.92, turnsElapsed: 3 }));
  assert.doesNotMatch(out.reason, /RTP_LOW/);
});

// ── Farkle rate stabiliser ────────────────────────────────────────────────────

test('farkle stabiliser: reduces non-scoring faces when rate is too high', () => {
  const out = computeWeights(base({ sessionFarkleRate: 0.30 }));
  assert.ok(out.spawnWeightAdjustments.face_2 < 0, 'face_2 should decrease when farkle rate is high');
  assert.match(out.reason, /FARKLE_HIGH/);
});

test('farkle stabiliser: increases non-scoring faces when rate is too low', () => {
  const out = computeWeights(base({ sessionFarkleRate: 0.04, turnsElapsed: 10 }));
  assert.ok(out.spawnWeightAdjustments.face_2 > 0, 'face_2 should increase when farkle rate is low');
  assert.match(out.reason, /FARKLE_LOW/);
});

test('farkle stabiliser: no increase before 5 turns', () => {
  const out = computeWeights(base({ sessionFarkleRate: 0.04, turnsElapsed: 3 }));
  assert.doesNotMatch(out.reason, /FARKLE_LOW/);
});

// ── Input validation ──────────────────────────────────────────────────────────

test('throws RangeError on NaN currentRTP', () => {
  assert.throws(() => computeWeights(base({ currentRTP: NaN })), { name: 'RangeError' });
});

test('throws RangeError on Infinity targetRTP', () => {
  assert.throws(() => computeWeights(base({ targetRTP: Infinity })), { name: 'RangeError' });
});

test('throws RangeError on -Infinity sessionFarkleRate', () => {
  assert.throws(() => computeWeights(base({ sessionFarkleRate: -Infinity })), { name: 'RangeError' });
});

// ── Bias clamping ─────────────────────────────────────────────────────────────

test('bias clamping: no face exceeds FACE_BIAS_CAP', () => {
  // Extreme scenario: combine slipstream + rally + high farkle rate
  const out = computeWeights({
    mode: 'RALLY_FREE',
    playerRank: 5,
    playerCount: 5,
    turnsElapsed: 50,
    currentRTP: 0.50,
    targetRTP: 0.95,
    sessionFarkleRate: 0.40,
  });
  for (const [face, val] of Object.entries(out.spawnWeightAdjustments)) {
    assert.ok(Math.abs(val) <= FACE_BIAS_CAP, `${face} weight ${val} exceeds ±${FACE_BIAS_CAP}`);
  }
});

// ── Edge cases ────────────────────────────────────────────────────────────────

test('zero turnsElapsed does not throw', () => {
  assert.doesNotThrow(() => computeWeights(base({ turnsElapsed: 0 })));
});

test('no adjustment reason when inputs are all nominal', () => {
  const out = computeWeights(base());
  assert.equal(out.reason, 'NO_ADJUSTMENT');
});
