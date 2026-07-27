// SURFACE file (not sacred). Client-local equivalent of the grid-owning half
// of GameRoom (core/apps/server/src/gameRoom.ts) for solo mode — there is no
// server to be authoritative over in single-player, so this instance IS the
// authority for its own session. Scoring/energy/bonus bookkeeping stays in
// the sacred useFarkleStore exactly as before (commitChain, addEnergy, etc.)
// — this class only owns the grid, mirroring GameRoom's this.state.grid +
// this.pool, using the same shared, isomorphic farkle-engine functions the
// server uses (resolveChainFaces, boardEngine, applyStandardBomb, etc.).

import { CSPRNG } from '@match3d/farkle-engine/csprng';
import {
  SixPoolManager,
  createGrid,
  hasValidChain,
  resolveChainFaces,
  applyStandardBomb,
} from '@match3d/farkle-engine/gridUtils';
import { resolveChainAndAdvance } from '@match3d/farkle-engine/boardEngine';
import type { Cell, GridPos, LobbySettings } from '@match3d/farkle-shared';

const SOLO_GRID_SIZE = 7;

function localSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export class SoloEngine {
  grid: Cell[][];
  private pool: SixPoolManager;

  constructor(blockerDensity: LobbySettings['blockerDensity'] = 'MEDIUM') {
    const csprng = new CSPRNG(localSeed());
    this.pool = new SixPoolManager(1, csprng);
    this.grid = createGrid(SOLO_GRID_SIZE, { blockerDensity }, this.pool);
  }

  resolveFaces(chain: GridPos[]) {
    return resolveChainFaces(this.grid, chain);
  }

  /** Consume the scored chain's cells, settle gravity, refill — call after a
   * non-farkle commit, mirroring gameRoom.ts's processChain(). */
  refillAfterChain(chain: GridPos[], catalystBoostPct: number) {
    this.grid = resolveChainAndAdvance(this.grid, this.pool, chain, catalystBoostPct);
  }

  collectOrb(row: number, col: number): boolean {
    const cell = this.grid[row]?.[col];
    if (!cell || cell.type !== 'MULTIPLIER_ORB') return false;
    this.grid = this.grid.map(r => r.map(c => ({ ...c })));
    this.grid[row]![col] = { id: cell.id, face: null, type: 'NONE', state: 'EMPTY' };
    return true;
  }

  anchorGhost(row: number, col: number): boolean {
    const cell = this.grid[row]?.[col];
    if (!cell || cell.state !== 'GHOST_PENDING') return false;
    this.grid = this.grid.map(r => r.map(c => ({ ...c })));
    this.grid[row]![col] = { ...cell, state: 'NORMAL' };
    return true;
  }

  /** Returns energy gained (0 if the tap was invalid). */
  tapSphere(row: number, col: number): number {
    const cell = this.grid[row]?.[col];
    if (!cell || cell.type !== 'SPHERE') return 0;
    this.grid = this.grid.map(r => r.map(c => ({ ...c })));
    this.grid[row]![col] = { id: cell.id, face: null, type: 'NONE', state: 'EMPTY' };
    return 8; // matches the server's TAP_SPHERE handler / the client's prior live literal
  }

  /** Returns points earned (0 if the tap was invalid). */
  detonateBomb(row: number, col: number): number {
    const cell = this.grid[row]?.[col];
    if (!cell || cell.type !== 'BOMB_STANDARD') return 0;
    const { grid, ptsEarned } = applyStandardBomb(this.grid, row, col);
    this.grid = grid;
    return ptsEarned;
  }

  /** Face-based rainbow bomb (matches the live client behavior, not the
   * color-based sacred applyRainbowBomb — see gameRoom.ts's DETONATE_RAINBOW_BOMB
   * handler for the same discrepancy note). Returns points earned. */
  detonateRainbowBomb(row: number, col: number, targetFace?: number): number {
    const cell = this.grid[row]?.[col];
    if (!cell || cell.type !== 'BOMB_RAINBOW') return 0;
    const faceCounts: Record<number, number> = {};
    for (const gr of this.grid) {
      for (const gc of gr) {
        if (gc.face !== null && gc.state === 'NORMAL') faceCounts[gc.face] = (faceCounts[gc.face] ?? 0) + 1;
      }
    }
    let bestFace = targetFace;
    if (bestFace === undefined) {
      let bestCount = 0;
      for (const [f, c] of Object.entries(faceCounts)) {
        if (c > bestCount) { bestCount = c; bestFace = Number(f); }
      }
    }
    let ptsEarned = 0;
    const cleared = this.grid.map(r => r.map(c => ({ ...c })));
    if (bestFace !== undefined) {
      for (let r = 0; r < cleared.length; r++) {
        for (let c = 0; c < cleared[r]!.length; c++) {
          const gc = cleared[r]![c]!;
          if (gc.face === bestFace && gc.state === 'NORMAL') {
            if (gc.face === 1) ptsEarned += 100;
            else if (gc.face === 5) ptsEarned += 50;
            cleared[r]![c] = { id: gc.id, face: null, type: 'NONE', state: 'EMPTY' };
          }
        }
      }
    }
    cleared[row]![col] = { id: cell.id, face: null, type: 'NONE', state: 'EMPTY' };
    this.grid = cleared;
    return ptsEarned;
  }

  isDeadBoard(): boolean {
    return !hasValidChain(this.grid);
  }

  /** Redraws all die/wild faces in place (blockers untouched) — same
   * fallback gameRoom.ts's _reshuffleGridFaces uses on dead-board recovery. */
  reshuffleFaces(): void {
    const next = this.grid.map(row => row.map(cell => {
      if (cell.type === 'STONE' || cell.state === 'EMPTY') return cell;
      if (cell.state === 'FROZEN' || cell.state === 'LOCKED') return cell;
      const d = this.pool.drawDie();
      const face = (d >= 1 && d <= 6 ? d : 1) as Cell['face'];
      return { ...cell, face };
    }));
    this.grid = next;
  }
}
