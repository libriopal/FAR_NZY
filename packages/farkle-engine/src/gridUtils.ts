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

import type { Cell, DieFace, GridPos, LobbySettings } from '@match3d/farkle-shared';
import { FACE_TO_COLOR, GAME_CONSTANTS, MIRROR_OPPOSITES } from '@match3d/farkle-shared';
import { CSPRNG, seededRng } from './csprng.js';
import { lookupScore, buildScoreTable } from './chainIndex.js';
import { nanoid } from 'nanoid';

// ── Scan table (lazy) ─────────────────────────────────────────────────────────

let _scanTable: Int32Array | null = null;
function getScanTable(): Int32Array {
  if (!_scanTable) _scanTable = buildScoreTable();
  return _scanTable;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashSeedString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeDieCell(face: DieFace): Cell {
  return { id: nanoid(), face, type: FACE_TO_COLOR[face], state: 'NORMAL' };
}

function makeStoneCell(rng?: () => number): Cell {
  const maxHp = GAME_CONSTANTS.STONE_HP;
  const health = rng ? Math.floor(rng() * maxHp) + 1 : maxHp;
  return { id: nanoid(), face: null, type: 'STONE', state: 'NORMAL', health };
}

function makeIceCell(face: DieFace): Cell {
  return { id: nanoid(), face, type: 'ICE', state: 'FROZEN' };
}

function makeLockCell(face: DieFace): Cell {
  return { id: nanoid(), face, type: 'LOCK', state: 'LOCKED' };
}

function makeWildCell(face: DieFace): Cell {
  return { id: nanoid(), face, type: 'NONE', state: 'WILD' };
}

function makeEmptyCell(): Cell {
  return { id: nanoid(), face: null, type: 'NONE', state: 'EMPTY' };
}

// ── SixPoolManager ────────────────────────────────────────────────────────────

const BLOCKER_DENSITY_COUNTS = { LOW: 4, MEDIUM: 6, HIGH: 10 };

export class SixPoolManager {
  private dieLive: number[];
  private dieDead: number[];
  private dieIdx: number;
  private wildLive: number[];
  private wildDead: number[];
  private wildIdx: number;
  private rng: () => number;
  private playerCount: number;
  private snapCounter: number;

  constructor(playerCount: number, csprng: CSPRNG) {
    this.playerCount = playerCount;
    this.snapCounter = 0;
    const numericSeed = hashSeedString(csprng.getSeed());
    this.rng = seededRng(numericSeed);

    const dim = multiplayerGridSize(playerCount);
    const diePoolSize = Math.ceil((dim * dim) / 6) * 6;
    const blockerCount = BLOCKER_DENSITY_COUNTS.MEDIUM;
    const wildPoolSize = Math.ceil((dim * dim) / 4);

    const perFace = diePoolSize / 6;
    this.dieLive = [];
    for (let f = 1; f <= 6; f++) {
      for (let n = 0; n < perFace; n++) this.dieLive.push(f);
    }
    shuffle(this.dieLive, this.rng);
    this.dieIdx = 0;
    this.dieDead = [];

    this.wildLive = [];
    for (let i = 0; i < wildPoolSize; i++) {
      const r = this.rng();
      if (r < 0.60) this.wildLive.push(0);
      else if (r < 0.75) this.wildLive.push(1);
      else if (r < 0.90) this.wildLive.push(2);
      else this.wildLive.push(3);
    }
    shuffle(this.wildLive, this.rng);
    this.wildIdx = 0;
    this.wildDead = [];

    void blockerCount;
  }

  drawDie(): number {
    if (this.dieIdx >= this.dieLive.length) {
      if (this.dieDead.length > 0) {
        this.dieLive = shuffle([...this.dieDead], this.rng);
        this.dieDead = [];
        this.dieIdx = 0;
      } else {
        return (Math.floor(this.rng() * 6) + 1);
      }
    }
    const val = this.dieLive[this.dieIdx++];
    this.dieDead.push(val);
    return val;
  }

  // boostPct (ADR-025, CATALYST_WILD_BOOST accumulation, 0-CATALYST_MAX_BOOST):
  // a non-wild draw gets a boostPct% second chance to upgrade to a fresh
  // wild-tier roll, using the same relative tier weighting as pool
  // construction (0.60/0.75/0.90 → 1/2/3, line ~108-111 above). Deterministic
  // — draws from the same seeded `this.rng`, no new randomness source.
  drawWild(boostPct = 0): number {
    if (this.wildIdx >= this.wildLive.length) {
      if (this.wildDead.length > 0) {
        this.wildLive = shuffle([...this.wildDead], this.rng);
        this.wildDead = [];
        this.wildIdx = 0;
      } else {
        return 0;
      }
    }
    const val = this.wildLive[this.wildIdx++];
    this.wildDead.push(val);
    if (val === 0 && boostPct > 0 && this.rng() * 100 < boostPct) {
      const r = this.rng();
      if (r < 0.5) return 1;
      if (r < 0.8) return 2;
      return 3;
    }
    return val;
  }

  remaining(): { die: number; wild: number } {
    return {
      die: this.dieLive.length - this.dieIdx,
      wild: this.wildLive.length - this.wildIdx
    };
  }

  reshuffle(): void {
    this.dieLive = shuffle([...this.dieLive, ...this.dieDead], this.rng);
    this.dieIdx = 0;
    this.dieDead = [];
    this.wildLive = shuffle([...this.wildLive, ...this.wildDead], this.rng);
    this.wildIdx = 0;
    this.wildDead = [];
  }

  snapshot(): object {
    return {
      counter: this.snapCounter++,
      playerCount: this.playerCount,
      dieRemaining: this.remaining().die,
      wildRemaining: this.remaining().wild,
    };
  }
}

// ── Grid size ─────────────────────────────────────────────────────────────────

export function multiplayerGridSize(playerCount: number): number {
  if (playerCount <= 1) return 7;
  if (playerCount === 2) return 8;
  if (playerCount === 3) return 9;
  return 10;
}

// ── Grid creation helpers ─────────────────────────────────────────────────────

// Biased placement: 70% chance each subsequent stone spawns adjacent to an
// existing stone, producing vein/chunk formations. Mutates `pool` in-place.
function _clusterPlace(pool: GridPos[], count: number, rng: () => number): GridPos[] {
  const placed: GridPos[] = [];
  if (count === 0 || pool.length === 0) return placed;

  const takeIdx = (idx: number) => {
    const pos = pool[idx]!;
    pool.splice(idx, 1);
    return pos;
  };

  // First stone: random
  placed.push(takeIdx(Math.floor(rng() * pool.length)));

  for (let n = 1; n < count && pool.length > 0; n++) {
    if (rng() < 0.70) {
      // Try to find a candidate adjacent to any already-placed stone
      const anchor = placed[Math.floor(rng() * placed.length)]!;
      const adjIdx = pool.findIndex(p =>
        Math.abs(p.row - anchor.row) <= 1 &&
        Math.abs(p.col - anchor.col) <= 1 &&
        !(p.row === anchor.row && p.col === anchor.col)
      );
      if (adjIdx !== -1) {
        placed.push(takeIdx(adjIdx));
        continue;
      }
    }
    // Fallback: random from remaining pool
    placed.push(takeIdx(Math.floor(rng() * pool.length)));
  }
  return placed;
}

// ── Grid creation ─────────────────────────────────────────────────────────────

const BLOCKER_DENSITY_RANGES = {
  LOW: { min: 3, max: 4 },
  MEDIUM: { min: 5, max: 7 },
  HIGH: { min: 8, max: 12 },
};

export function createGrid(
  size: number,
  settings: Pick<LobbySettings, 'blockerDensity'>,
  pool: SixPoolManager,
  seedNum = Date.now()
): Cell[][] {
  const rng = seededRng(seedNum);
  const densityRange = BLOCKER_DENSITY_RANGES[settings.blockerDensity];
  const blockerCount = Math.floor(rng() * (densityRange.max - densityRange.min + 1)) + densityRange.min;

  const stoneCount = Math.floor(blockerCount * 0.5);
  const iceCount = Math.floor(blockerCount * 0.25);
  const lockCount = blockerCount - stoneCount - iceCount;

  const grid: Cell[][] = Array.from({ length: size }, () => Array(size).fill(null));

  const candidates: GridPos[] = [];
  for (let r = 1; r <= size - 2; r++) {
    for (let c = 1; c <= size - 2; c++) {
      candidates.push({ row: r, col: c });
    }
  }
  shuffle(candidates, rng);

  // Stone clustering: each new stone has a 70% chance to place adjacent to an
  // existing stone, creating vein/chunk layouts. Total count is unchanged.
  const stonePos = _clusterPlace(candidates, stoneCount, rng);
  const icePos = candidates.splice(0, iceCount);
  const lockPos = candidates.splice(0, lockCount);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isStone = stonePos.some(p => p.row === r && p.col === c);
      const isIce = icePos.some(p => p.row === r && p.col === c);
      const isLock = lockPos.some(p => p.row === r && p.col === c);

      if (isStone) {
        grid[r][c] = makeStoneCell(rng);
      } else if (isIce) {
        const d = pool.drawDie();
        const face = (d >= 1 && d <= 6 ? d : 1) as DieFace;
        grid[r][c] = makeIceCell(face);
      } else if (isLock) {
        const d = pool.drawDie();
        const face = (d >= 1 && d <= 6 ? d : 1) as DieFace;
        grid[r][c] = makeLockCell(face);
      } else {
        const w = pool.drawWild();
        if (w === 3) {
          const wd = pool.drawDie();
          const wface = (wd >= 1 && wd <= 6 ? wd : 1) as DieFace;
          grid[r][c] = makeWildCell(wface);
        } else {
          const d = pool.drawDie();
          const face = (d >= 1 && d <= 6 ? d : 1) as DieFace;
          grid[r][c] = makeDieCell(face);
        }
      }
    }
  }
  return grid;
}

// ── Gravity & spawn ───────────────────────────────────────────────────────────

export function stepGravity(grid: Cell[][]): { grid: Cell[][], changed: boolean } {
  const newGrid = cloneGrid(grid);
  let changed = false;
  const rows = newGrid.length;
  const cols = newGrid[0].length;

  for (let r = rows - 2; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const cell = newGrid[r][c];
      const canFall = cell.state === 'WILD' || cell.state === 'MIRROR' || cell.type === 'ICE' || (
        cell.state === 'NORMAL' &&
        (isDieTile(cell) || cell.type === 'BOMB_STANDARD' || cell.type === 'BOMB_RAINBOW')
      );
      if (canFall) {
        if (newGrid[r + 1][c].state === 'EMPTY') {
          newGrid[r + 1][c] = cell;
          newGrid[r][c] = makeEmptyCell();
          changed = true;
        }
      }
    }
  }
  return { grid: newGrid, changed };
}

export function hasEmptyBelow(grid: Cell[][]): boolean {
  const rows = grid.length;
  const cols = grid[0].length;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const canFall = cell.state === 'WILD' || cell.state === 'MIRROR' || cell.type === 'ICE' || (
        cell.state === 'NORMAL' && isDieTile(cell)
      );
      if (canFall && grid[r + 1][c].state === 'EMPTY') return true;
    }
  }
  return false;
}

export function spawnTiles(
  grid: Cell[][],
  pool: SixPoolManager,
  catalystBoostPct = 0
): { grid: Cell[][], changed: boolean } {
  const newGrid = cloneGrid(grid);
  let changed = false;
  const cols = newGrid[0].length;

  for (let c = 0; c < cols; c++) {
    if (newGrid[0][c].state === 'EMPTY') {
      if (newGrid[0][c].type === 'BOMB_STANDARD' || newGrid[0][c].type === 'BOMB_RAINBOW') {
        continue;
      }
      const w = pool.drawWild(catalystBoostPct);
      if (w === 3) {
        const wd = pool.drawDie();
        const wface = (wd >= 1 && wd <= 6 ? wd : 1) as DieFace;
        newGrid[0][c] = makeWildCell(wface);
      } else {
        const d = pool.drawDie();
        const face = (d >= 1 && d <= 6 ? d : 1) as DieFace;
        const cell = makeDieCell(face);
        cell.state = 'SPAWNING';
        newGrid[0][c] = cell;
      }
      changed = true;
    }
  }
  return { grid: newGrid, changed };
}

export function normalizeTiles(grid: Cell[][]): Cell[][] {
  const newGrid = cloneGrid(grid);
  for (let r = 0; r < newGrid.length; r++) {
    for (let c = 0; c < newGrid[0].length; c++) {
      if (newGrid[r][c].state === 'SPAWNING') {
        newGrid[r][c].state = 'NORMAL';
      }
    }
  }
  return newGrid;
}

// ── Bomb application ──────────────────────────────────────────────────────────

export function applyStandardBomb(
  grid: Cell[][],
  bombRow: number,
  bombCol: number,
  isHeadhunter = false
): { grid: Cell[][], ptsEarned: number, affected: GridPos[] } {
  const newGrid = cloneGrid(grid);
  let ptsEarned = 25; // bomb self-score for detonation
  const affected: GridPos[] = [];
  const rows = newGrid.length;
  const cols = newGrid[0].length;
  const radius = GAME_CONSTANTS.BOMB_RADIUS;

  for (let r = Math.max(0, bombRow - radius); r <= Math.min(rows - 1, bombRow + radius); r++) {
    for (let c = Math.max(0, bombCol - radius); c <= Math.min(cols - 1, bombCol + radius); c++) {
      const cell = newGrid[r][c];
      if (cell.state === 'LOCKED') continue;
      affected.push({ row: r, col: c });

      if (cell.type === 'STONE') {
        const damage = isHeadhunter ? 2 : 1;
        cell.health = (cell.health ?? GAME_CONSTANTS.STONE_HP) - damage;
        if (cell.health <= 0) {
          newGrid[r][c] = makeEmptyCell();
          ptsEarned += GAME_CONSTANTS.BOMB_STONE_PTS;
        }
      } else if (cell.type === 'ICE' || cell.state === 'FROZEN') {
        newGrid[r][c] = makeEmptyCell();
      } else if (cell.type === 'BOMB_STANDARD' || cell.type === 'BOMB_RAINBOW') {
        newGrid[r][c] = makeEmptyCell();
      } else if (isDieTile(cell)) {
        newGrid[r][c] = makeEmptyCell();
        // Farkle-consistent: 1s=100pts, 5s=50pts, other faces=0pts
        if (cell.face === 1) ptsEarned += 100;
        else if (cell.face === 5) ptsEarned += 50;
      }
    }
  }
  return { grid: newGrid, ptsEarned, affected };
}

export function applyRainbowBomb(
  grid: Cell[][],
  targetColor: string,
  multiplier: number,
  rainbowRedReward: number,
  rainbowBlueReward: number
): { grid: Cell[][], ptsEarned: number, affected: GridPos[] } {
  const newGrid = cloneGrid(grid);
  let ptsEarned = 0;
  const affected: GridPos[] = [];
  const rows = newGrid.length;
  const cols = newGrid[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = newGrid[r][c];
      if (cell.state === 'LOCKED') continue;
      if (cell.type === 'STONE' || cell.type === 'ICE') continue;
      if (cell.type === targetColor) {
        affected.push({ row: r, col: c });
        newGrid[r][c] = makeEmptyCell();
        if (targetColor === 'RED') ptsEarned += rainbowRedReward * multiplier;
        else if (targetColor === 'BLUE') ptsEarned += rainbowBlueReward * multiplier;
      }
    }
  }
  return { grid: newGrid, ptsEarned, affected };
}

// ── Blocker damage ────────────────────────────────────────────────────────────

export function damageAdjacentBlockers(
  grid: Cell[][],
  chain: GridPos[],
  isHeadhunter = false
): Cell[][] {
  const g = cloneGrid(grid);
  const rows = g.length;
  const cols = g[0].length;
  const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
  const chainSet = new Set(chain.map(p => `${p.row},${p.col}`));

  for (const pos of chain) {
    for (const { dr, dc } of dirs) {
      const nr = pos.row + dr;
      const nc = pos.col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (chainSet.has(`${nr},${nc}`)) continue;
      const cell = g[nr][nc];
      if (cell.type !== 'STONE') continue;
      const damage = isHeadhunter ? 2 : 1;
      const newHealth = Math.max(0, (cell.health ?? 2) - damage);
      if (newHealth === 0) {
        g[nr][nc] = { id: cell.id, face: null, type: 'NONE', state: 'EMPTY' };
      } else {
        g[nr][nc] = { ...cell, health: newHealth };
      }
    }
  }
  return g;
}

// ── Chain validation ──────────────────────────────────────────────────────────

function _isChainableTile(cell: Cell): boolean {
  return isDieTile(cell) || cell.state === 'WILD' || cell.state === 'MIRROR';
}

function _rawFace(cell: Cell): number {
  return cell.state === 'WILD' ? 0 : (cell.face as DieFace);
}

function _resolveWilds(faces: number[]): DieFace[] {
  const wildIdx = faces.reduce<number[]>((acc, f, i) => (f === 0 ? [...acc, i] : acc), []);
  if (wildIdx.length === 0) return faces as DieFace[];

  const numWilds = wildIdx.length;
  const total = Math.pow(6, numWilds);
  let bestScore = -1;
  let bestFaces = faces.slice() as DieFace[];

  for (let combo = 0; combo < total; combo++) {
    const candidate = faces.slice() as DieFace[];
    let c = combo;
    for (let w = 0; w < numWilds; w++) {
      candidate[wildIdx[w]] = ((c % 6) + 1) as DieFace;
      c = Math.floor(c / 6);
    }
    const score = lookupScore(candidate, getScanTable());
    if (score > bestScore) { bestScore = score; bestFaces = candidate.slice(); }
  }
  return bestFaces;
}

// ── Live chain scoring resolution (ADR-025) ───────────────────────────────────
//
// NOT the same algorithm as _resolveWilds/hasValidChain above — those maximize
// score to answer "does ANY valid chain exist" (dead-board detection). This
// resolves what a SUBMITTED chain actually scores, and must match
// VoxelPhysicsSystem.resolveMirrorFace / useFarkleGame.ts's
// _resolveChainFacesForChain exactly (plurality for wild, raw-neighbor lookup
// for mirror) to avoid drifting from calibrated RTP/Monte Carlo behavior.

function _plurality(faces: number[]): number | undefined {
  if (faces.length === 0) return undefined;
  const counts: Record<number, number> = {};
  for (const f of faces) counts[f] = (counts[f] ?? 0) + 1;
  let best: number | undefined; let bestC = 0;
  for (const [f, c] of Object.entries(counts)) {
    if (c > bestC) { bestC = c; best = Number(f); }
  }
  return best;
}

export function resolveChainFaces(grid: Cell[][], chain: GridPos[]): DieFace[] {
  const cells = chain
    .map(pos => grid[pos.row]?.[pos.col])
    .filter((c): c is Cell => c !== undefined);

  // Raw per-position value: real face for normal/mirror cells, 0 sentinel for
  // wild — mirror resolution reads this RAW array (pre-resolution), matching
  // the client's exact semantics including the mirror-next-to-wild edge case
  // (MIRROR_OPPOSITES[0] is undefined, falls back to the raw 0 itself).
  const raw: number[] = cells.map(cell => (cell.state === 'WILD' ? 0 : (cell.face ?? 1)));
  const nonSpecial = raw.filter((f, i) => f !== 0 && cells[i]!.state !== 'MIRROR');

  return raw.map((f, i) => {
    const cell = cells[i]!;
    if (cell.state === 'WILD' || f === 0) {
      return (_plurality(nonSpecial) ?? 1) as DieFace;
    }
    if (cell.state === 'MIRROR') {
      const neighborFace = raw[i - 1] ?? raw[i + 1] ?? 1;
      return (MIRROR_OPPOSITES[neighborFace] ?? neighborFace) as DieFace;
    }
    return f as DieFace;
  });
}

export function hasValidChain(grid: Cell[][]): boolean {
  const rows = grid.length;
  const cols = grid[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startCell = grid[r][c];
      if (!_isChainableTile(startCell)) continue;

      const queue: { path: GridPos[], faces: number[] }[] = [];
      queue.push({ path: [{ row: r, col: c }], faces: [_rawFace(startCell)] });

      while (queue.length > 0) {
        const { path, faces } = queue.shift()!;
        if (lookupScore(_resolveWilds(faces), getScanTable()) > 0) return true;
        if (path.length >= GAME_CONSTANTS.MAX_CHAIN) continue;

        const lastPos = path[path.length - 1];
        for (const n of getNeighbors(grid, lastPos.row, lastPos.col)) {
          if (path.some(p => p.row === n.row && p.col === n.col)) continue;
          const nCell = grid[n.row][n.col];
          if (!_isChainableTile(nCell)) continue;
          queue.push({ path: [...path, n], faces: [...faces, _rawFace(nCell)] });
        }
      }
    }
  }
  return false;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function isDieTile(cell: Cell): boolean {
  return (
    cell.face !== null &&
    cell.type !== 'NONE' &&
    cell.type !== 'STONE' &&
    cell.type !== 'ICE' &&
    cell.type !== 'BOMB_STANDARD' &&
    cell.type !== 'BOMB_RAINBOW'
  );
}

export function scanForWilds(grid: Cell[][]): number {
  let count = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c].state === 'WILD') count++;
    }
  }
  return count;
}

export function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map(row => row.map(cell => ({ ...cell })));
}

export function getNeighbors(grid: Cell[][], row: number, col: number): GridPos[] {
  const rows = grid.length;
  const cols = grid[0].length;
  const neighbors: GridPos[] = [];
  if (row > 0) neighbors.push({ row: row - 1, col });
  if (row < rows - 1) neighbors.push({ row: row + 1, col });
  if (col > 0) neighbors.push({ row, col: col - 1 });
  if (col < cols - 1) neighbors.push({ row, col: col + 1 });
  return neighbors;
}
