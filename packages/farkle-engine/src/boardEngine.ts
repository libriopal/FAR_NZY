// Board-tick engine for GAP-1b (docs/adr/ADR-024-gap1b-option1-server-authoritative-board.md).
//
// NOT in .ff-core-lock — flagged for human review at merge time since it is
// scoring-adjacent (it decides what dice become available after a chain is
// scored), but it does not itself compute scores or touch payout math.
//
// Deliberately event-driven, not tick-indexed: the board only advances once,
// synchronously, per resolved (non-farkle) chain submission. This is simpler
// than ADR-024's suggested periodic tick loop and satisfies the same
// constraints (deterministic, replayable, no physics, minimal server load) —
// there is no wall-clock jitter to buffer against because there is no
// wall-clock-driven state change in the first place.
//
// Determinism: given the same (grid, pool-draw-sequence, chain), the result
// is identical — stepGravity/spawnTiles/normalizeTiles are pure functions
// (packages/farkle-engine/src/gridUtils.ts, sacred, untouched by this file),
// and the only randomness is SixPoolManager's CSPRNG-seeded draws.

import type { Cell, GridPos } from '@match3d/farkle-shared';
import { nanoid } from 'nanoid';
import {
  cloneGrid,
  hasEmptyBelow,
  normalizeTiles,
  spawnTiles,
  stepGravity,
  type SixPoolManager,
} from './gridUtils.js';

function makeEmptyCell(): Cell {
  return { id: nanoid(), face: null, type: 'NONE', state: 'EMPTY' };
}

/** Clears the cells a scored chain passed through. Does not touch blockers —
 * chain cells are always die/wild tiles (validated by the caller before this
 * runs), never STONE/ICE/LOCK. */
export function consumeChain(grid: Cell[][], chain: GridPos[]): Cell[][] {
  const next = cloneGrid(grid);
  for (const { row, col } of chain) {
    if (next[row]?.[col]) next[row]![col] = makeEmptyCell();
  }
  return next;
}

/** Settles gravity to a fixed point, then refills the top row from the pool.
 * Bounded by grid height — a cell can fall at most `rows - 1` times, so this
 * always terminates without needing a "changed" sentinel loop. */
export function advanceBoard(grid: Cell[][], pool: SixPoolManager, catalystBoostPct = 0): Cell[][] {
  let current = grid;
  const maxFalls = grid.length;
  for (let i = 0; i < maxFalls; i++) {
    const { grid: settled, changed } = stepGravity(current);
    current = settled;
    if (!changed) break;
  }
  if (hasEmptyBelow(current)) {
    // Should not happen after the bounded settle loop above; defensive only.
    current = stepGravity(current).grid;
  }
  const { grid: spawned } = spawnTiles(current, pool, catalystBoostPct);
  return normalizeTiles(spawned);
}

/** Composed step: consume the scored chain's cells, then settle + refill.
 * This is what `processChain` calls after a non-farkle scoring result. */
export function resolveChainAndAdvance(
  grid: Cell[][],
  pool: SixPoolManager,
  chain: GridPos[],
  catalystBoostPct = 0,
): Cell[][] {
  return advanceBoard(consumeChain(grid, chain), pool, catalystBoostPct);
}
