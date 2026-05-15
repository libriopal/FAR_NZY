// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import type { LevelDef } from '@match3d/farkle-shared';

// TITAN v1.0 — "VERY RARELY" BALANCE
// Bomb/Blocker entities (bomb, rainbow_bomb, ice, lock, stone) are reduced to
// weight ≤1 across all levels — they should feel like sudden "Infection" events,
// not standard obstacles. Score multiplier unlocks concentrate in later levels.
// Redistributed weight goes to die + wild + catalyst for richer chain play.

export const LEVELS: LevelDef[] = [
  {
    id: 'level_01',
    name: 'Seedling Plot',
    spawnWeights: { die:70, sphere:28, ice:0, lock:0, wild:0, bomb:0, rainbow_bomb:0, mirror:1, stone:0, multiplier_orb:1, ghost:0, catalyst:0 },
    winScore: 25_000,
    timeLimitSec: null,
    energyMultiplier: 1.0,
  },
  {
    id: 'level_02',
    name: 'Glass Frame',
    spawnWeights: { die:67, sphere:25, ice:1, lock:0, wild:1, bomb:0, rainbow_bomb:0, mirror:3, stone:0, multiplier_orb:2, ghost:1, catalyst:0 },
    winScore: 40_000,
    timeLimitSec: null,
    energyMultiplier: 1.0,
  },
  {
    id: 'level_03',
    name: 'Vine Trellis',
    spawnWeights: { die:66, sphere:22, ice:1, lock:0, wild:3, bomb:0, rainbow_bomb:0, mirror:4, stone:1, multiplier_orb:2, ghost:1, catalyst:0 },
    winScore: 55_000,
    timeLimitSec: null,
    energyMultiplier: 1.0,
  },
  {
    id: 'level_04',
    name: 'Bioluminescent Bay',
    spawnWeights: { die:62, sphere:20, ice:1, lock:1, wild:4, bomb:0, rainbow_bomb:0, mirror:5, stone:1, multiplier_orb:4, ghost:2, catalyst:0 },
    winScore: 65_000,
    timeLimitSec: 300,
    energyMultiplier: 1.1,
  },
  {
    id: 'level_05',
    name: 'Aero Scaffold',
    spawnWeights: { die:59, sphere:18, ice:1, lock:1, wild:5, bomb:1, rainbow_bomb:0, mirror:6, stone:1, multiplier_orb:4, ghost:2, catalyst:2 },
    winScore: 75_000,
    timeLimitSec: 270,
    energyMultiplier: 1.1,
  },
  {
    id: 'level_06',
    name: 'Steel Canopy',
    spawnWeights: { die:57, sphere:16, ice:1, lock:1, wild:7, bomb:1, rainbow_bomb:0, mirror:6, stone:1, multiplier_orb:4, ghost:2, catalyst:4 },
    winScore: 80_000,
    timeLimitSec: 240,
    energyMultiplier: 1.2,
  },
  {
    id: 'level_07',
    name: 'Hydro Core',
    spawnWeights: { die:52, sphere:15, ice:1, lock:1, wild:9, bomb:1, rainbow_bomb:0, mirror:7, stone:1, multiplier_orb:5, ghost:3, catalyst:5 },
    winScore: 85_000,
    timeLimitSec: 210,
    energyMultiplier: 1.2,
  },
  {
    id: 'level_08',
    name: 'Overgrowth Dome',
    spawnWeights: { die:48, sphere:13, ice:1, lock:1, wild:11, bomb:1, rainbow_bomb:1, mirror:7, stone:1, multiplier_orb:5, ghost:4, catalyst:7 },
    winScore: 90_000,
    timeLimitSec: 180,
    energyMultiplier: 1.3,
  },
  {
    id: 'level_09',
    name: 'Root Network',
    spawnWeights: { die:45, sphere:12, ice:1, lock:1, wild:13, bomb:1, rainbow_bomb:1, mirror:8, stone:1, multiplier_orb:5, ghost:5, catalyst:7 },
    winScore: 95_000,
    timeLimitSec: 180,
    energyMultiplier: 1.3,
  },
  {
    id: 'level_10',
    name: 'Grand Blueprint',
    spawnWeights: { die:43, sphere:12, ice:1, lock:1, wild:15, bomb:1, rainbow_bomb:1, mirror:8, stone:1, multiplier_orb:6, ghost:5, catalyst:6 },
    winScore: 100_000,
    timeLimitSec: null,
    energyMultiplier: 1.5,
  },
];

export const DEFAULT_LEVEL = LEVELS[9]!;
