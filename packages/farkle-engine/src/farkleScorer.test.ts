import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScoreTable, lookupScore } from './chainIndex.js';
import type { DieFace } from '@match3d/farkle-shared';

const table = buildScoreTable();
function score(faces: number[]): number {
  return lookupScore(faces as DieFace[], table);
}

// ── 16 scorer regression tests (PRESERVATION_SPEC) ──────────────────────────

test('single 1 → 100', () => assert.equal(score([1]), 100));
test('single 5 → 50', () => assert.equal(score([5]), 50));
test('single 2 → Farkle (0)', () => assert.equal(score([2]), 0));
test('single 6 → Farkle (0)', () => assert.equal(score([6]), 0));
test('pair of 1s → 200', () => assert.equal(score([1, 1]), 200));
test('pair of 5s → 100', () => assert.equal(score([5, 5]), 100));
test('three 1s → 1000', () => assert.equal(score([1, 1, 1]), 1000));
test('three 2s → 200', () => assert.equal(score([2, 2, 2]), 200));
test('three 5s → 500', () => assert.equal(score([5, 5, 5]), 500));
test('four 2s → 1000', () => assert.equal(score([2, 2, 2, 2]), 1000));
test('five 1s → 2000', () => assert.equal(score([1, 1, 1, 1, 1]), 2000));
test('six 1s → 3000', () => assert.equal(score([1, 1, 1, 1, 1, 1]), 3000));
test('straight (1-6) → 1500', () => assert.equal(score([1, 2, 3, 4, 5, 6]), 1500));
test('three pairs → 1500', () => assert.equal(score([2, 2, 3, 3, 4, 4]), 1500));

// W6: Maximum Partition rule — Two Triplets must beat greedy Three+Three greedy
// Greedy gives Three 1s (1000) + Three 2s (200) = 1200  ← WRONG
// Correct:  Two Triplets                          = 2500  ← REQUIRED
test('W6: Two Triplets [1,1,1,2,2,2] → 2500 not 1200', () => assert.equal(score([1, 1, 1, 2, 2, 2]), 2500));
test('W6: Two Triplets [2,2,2,3,3,3] → 2500', () => assert.equal(score([2, 2, 2, 3, 3, 3]), 2500));
