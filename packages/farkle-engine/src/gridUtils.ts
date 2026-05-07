import type { Cell, DieFace, GridPos, LobbySettings } from '@match3d/farkle-shared';
import { FACE_TO_COLOR, GAME_CONSTANTS } from '@match3d/farkle-shared';
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

function makeStoneCell(): Cell {
  return { id: nanoid(), face: null, type: 'STONE', state: 'NORMAL', health: GAME_CONSTANTS.STONE_HP };
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
    const csprngAny = csprng as unknown as { seed: string };
    const numericSeed = hashSeedString(csprngAny.seed ?? String(Date.now()));
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

  drawWild(): number {
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

  const stonePos = candidates.splice(0, stoneCount);
  const icePos = candidates.splice(0, iceCount);
  const lockPos = candidates.splice(0, lockCount);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isStone = stonePos.some(p => p.row === r && p.col === c);
      const isIce = icePos.some(p => p.row === r && p.col === c);
      const isLock = lockPos.some(p => p.row === r && p.col === c);

      if (isStone) {
        grid[r][c] = makeStoneCell();
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
      if (
        cell.state === 'NORMAL' &&
        (isDieTile(cell) || cell.type === 'BOMB_STANDARD' || cell.type === 'BOMB_RAINBOW')
      ) {
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
      if (cell.state === 'NORMAL' && isDieTile(cell)) {
        if (grid[r + 1][c].state === 'EMPTY') return true;
      }
    }
  }
  return false;
}

export function spawnTiles(
  grid: Cell[][],
  pool: SixPoolManager
): { grid: Cell[][], changed: boolean } {
  const newGrid = cloneGrid(grid);
  let changed = false;
  const cols = newGrid[0].length;

  for (let c = 0; c < cols; c++) {
    if (newGrid[0][c].state === 'EMPTY') {
      if (newGrid[0][c].type === 'BOMB_STANDARD' || newGrid[0][c].type === 'BOMB_RAINBOW') {
        continue;
      }
      const w = pool.drawWild();
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
  let ptsEarned = 0;
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
      } else if (isDieTile(cell)) {
        newGrid[r][c] = makeEmptyCell();
        ptsEarned += GAME_CONSTANTS.BOMB_DIE_PTS;
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

export function hasValidChain(grid: Cell[][]): boolean {
  const rows = grid.length;
  const cols = grid[0].length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startCell = grid[r][c];
      if (!isDieTile(startCell)) continue;

      const queue: { path: GridPos[], faces: DieFace[] }[] = [];
      queue.push({ path: [{ row: r, col: c }], faces: [startCell.face as DieFace] });

      while (queue.length > 0) {
        const { path, faces } = queue.shift()!;
        if (lookupScore(faces, getScanTable()) > 0) return true;
        if (path.length >= GAME_CONSTANTS.MAX_CHAIN) continue;

        const lastPos = path[path.length - 1];
        for (const n of getNeighbors(grid, lastPos.row, lastPos.col)) {
          if (path.some(p => p.row === n.row && p.col === n.col)) continue;
          const nCell = grid[n.row][n.col];
          if (!isDieTile(nCell)) continue;
          queue.push({ path: [...path, n], faces: [...faces, nCell.face as DieFace] });
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
