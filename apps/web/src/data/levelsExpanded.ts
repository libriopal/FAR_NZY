// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

// Levels 11-50: Track B content pipeline.
// Spawn weights derived from corpus genre taxonomy and TITAN v1.0 balance:
//   Gothic (674), Void (417), SkelGold (357), Cyberpunk (142),
//   Horror (123), Obsidian (177), Casino (181).
// Win scores continue the monotone sequence from levels 01-10 (100k).

import type { LevelDef } from '@match3d/farkle-shared';
import { LEVELS } from './levels.js';
import { assertLevelsValid } from './levelValidator.js';

// ── World 1: Gothic Cathedral (levels 11-18) ──────────────────────────────────
// Lock/stone pressure escalates. Ghost dice haunt the upper rows.
// Bombs arrive mid-world as ritualistic "judgement" events.
const WORLD_1: LevelDef[] = [
  {
    id: 'level_11',
    name: 'Gothic Reliquary',
    spawnWeights: { die:68, sphere:7, ice:1, lock:2, wild:0, bomb:0, rainbow_bomb:0, mirror:0, stone:2, multiplier_orb:4, ghost:2, catalyst:1 },
    winScore: 120_000, timeLimitSec: null, energyMultiplier: 1.5,
  },
  {
    id: 'level_12',
    name: 'Iron Altarpiece',
    spawnWeights: { die:66, sphere:7, ice:1, lock:2, wild:0, bomb:0, rainbow_bomb:0, mirror:0, stone:2, multiplier_orb:4, ghost:3, catalyst:1 },
    winScore: 145_000, timeLimitSec: null, energyMultiplier: 1.5,
  },
  {
    id: 'level_13',
    name: 'Ossuary Gate',
    spawnWeights: { die:64, sphere:6, ice:1, lock:3, wild:0, bomb:0, rainbow_bomb:0, mirror:0, stone:3, multiplier_orb:4, ghost:3, catalyst:1 },
    winScore: 175_000, timeLimitSec: 300, energyMultiplier: 1.6,
  },
  {
    id: 'level_14',
    name: 'Cathedral Veil',
    spawnWeights: { die:62, sphere:6, ice:1, lock:3, wild:0, bomb:0, rainbow_bomb:0, mirror:0, stone:3, multiplier_orb:4, ghost:4, catalyst:2 },
    winScore: 200_000, timeLimitSec: 270, energyMultiplier: 1.6,
  },
  {
    id: 'level_15',
    name: 'Sanctum Fault',
    spawnWeights: { die:60, sphere:6, ice:1, lock:3, wild:0, bomb:1, rainbow_bomb:0, mirror:0, stone:3, multiplier_orb:4, ghost:4, catalyst:2 },
    winScore: 230_000, timeLimitSec: 240, energyMultiplier: 1.7,
  },
  {
    id: 'level_16',
    name: 'Gothic Revenant',
    spawnWeights: { die:58, sphere:5, ice:1, lock:4, wild:0, bomb:1, rainbow_bomb:0, mirror:0, stone:4, multiplier_orb:4, ghost:5, catalyst:2 },
    winScore: 265_000, timeLimitSec: 210, energyMultiplier: 1.7,
  },
  {
    id: 'level_17',
    name: 'Bone Cistern',
    spawnWeights: { die:56, sphere:5, ice:1, lock:4, wild:0, bomb:1, rainbow_bomb:1, mirror:0, stone:4, multiplier_orb:4, ghost:5, catalyst:2 },
    winScore: 300_000, timeLimitSec: 180, energyMultiplier: 1.8,
  },
  {
    id: 'level_18',
    name: 'Archon Nave',
    spawnWeights: { die:53, sphere:5, ice:1, lock:4, wild:1, bomb:1, rainbow_bomb:1, mirror:0, stone:4, multiplier_orb:5, ghost:5, catalyst:3 },
    winScore: 340_000, timeLimitSec: 150, energyMultiplier: 1.8,
  },
];

// ── World 2: Void Dreamscape (levels 19-26) ───────────────────────────────────
// Mirror dice and ice crystals dominate. Ghost packs drift through void corridors.
// No bombs — this world rewards spatial pattern-reading over reaction.
const WORLD_2: LevelDef[] = [
  {
    id: 'level_19',
    name: 'Void Tendril',
    spawnWeights: { die:60, sphere:5, ice:2, lock:1, wild:0, bomb:0, rainbow_bomb:0, mirror:2, stone:1, multiplier_orb:4, ghost:4, catalyst:1 },
    winScore: 365_000, timeLimitSec: null, energyMultiplier: 1.8,
  },
  {
    id: 'level_20',
    name: 'Spectral Corridor',
    spawnWeights: { die:58, sphere:5, ice:2, lock:1, wild:0, bomb:0, rainbow_bomb:0, mirror:3, stone:1, multiplier_orb:4, ghost:5, catalyst:1 },
    winScore: 395_000, timeLimitSec: null, energyMultiplier: 1.9,
  },
  {
    id: 'level_21',
    name: 'Pale Sigil',
    spawnWeights: { die:56, sphere:5, ice:3, lock:1, wild:0, bomb:0, rainbow_bomb:0, mirror:3, stone:1, multiplier_orb:4, ghost:5, catalyst:1 },
    winScore: 430_000, timeLimitSec: 300, energyMultiplier: 1.9,
  },
  {
    id: 'level_22',
    name: 'Skeletal Canticle',
    spawnWeights: { die:54, sphere:5, ice:3, lock:2, wild:0, bomb:0, rainbow_bomb:0, mirror:4, stone:2, multiplier_orb:4, ghost:5, catalyst:1 },
    winScore: 465_000, timeLimitSec: 270, energyMultiplier: 2.0,
  },
  {
    id: 'level_23',
    name: 'Hollow Meridian',
    spawnWeights: { die:52, sphere:4, ice:3, lock:2, wild:1, bomb:0, rainbow_bomb:0, mirror:4, stone:2, multiplier_orb:4, ghost:6, catalyst:2 },
    winScore: 500_000, timeLimitSec: 240, energyMultiplier: 2.0,
  },
  {
    id: 'level_24',
    name: 'Ghost Lattice',
    spawnWeights: { die:49, sphere:4, ice:3, lock:2, wild:1, bomb:0, rainbow_bomb:0, mirror:5, stone:2, multiplier_orb:4, ghost:7, catalyst:2 },
    winScore: 535_000, timeLimitSec: 210, energyMultiplier: 2.0,
  },
  {
    id: 'level_25',
    name: 'Mirror Expanse',
    spawnWeights: { die:47, sphere:4, ice:4, lock:2, wild:1, bomb:0, rainbow_bomb:0, mirror:6, stone:2, multiplier_orb:4, ghost:7, catalyst:2 },
    winScore: 570_000, timeLimitSec: 180, energyMultiplier: 2.1,
  },
  {
    id: 'level_26',
    name: 'Liminal Scar',
    spawnWeights: { die:44, sphere:4, ice:4, lock:2, wild:1, bomb:0, rainbow_bomb:0, mirror:6, stone:2, multiplier_orb:5, ghost:8, catalyst:2 },
    winScore: 610_000, timeLimitSec: 150, energyMultiplier: 2.1,
  },
];

// ── World 3: Cyberpunk Overmind (levels 27-34) ────────────────────────────────
// Catalyst chains compound wild spawns at machine speed. Tight timers.
// Multiplier orbs reward fast-thinking sequential play.
const WORLD_3: LevelDef[] = [
  {
    id: 'level_27',
    name: 'Neural Override',
    spawnWeights: { die:55, sphere:4, ice:1, lock:1, wild:2, bomb:1, rainbow_bomb:0, mirror:0, stone:1, multiplier_orb:5, ghost:3, catalyst:5 },
    winScore: 640_000, timeLimitSec: 240, energyMultiplier: 2.1,
  },
  {
    id: 'level_28',
    name: 'Neon Syndicate',
    spawnWeights: { die:53, sphere:4, ice:1, lock:1, wild:2, bomb:1, rainbow_bomb:0, mirror:0, stone:1, multiplier_orb:5, ghost:3, catalyst:6 },
    winScore: 675_000, timeLimitSec: 210, energyMultiplier: 2.2,
  },
  {
    id: 'level_29',
    name: 'Catalyst Array',
    spawnWeights: { die:51, sphere:4, ice:1, lock:2, wild:3, bomb:1, rainbow_bomb:0, mirror:0, stone:1, multiplier_orb:5, ghost:4, catalyst:6 },
    winScore: 710_000, timeLimitSec: 210, energyMultiplier: 2.2,
  },
  {
    id: 'level_30',
    name: 'Hacker Conduit',
    spawnWeights: { die:49, sphere:3, ice:1, lock:2, wild:3, bomb:1, rainbow_bomb:0, mirror:0, stone:1, multiplier_orb:5, ghost:4, catalyst:7 },
    winScore: 750_000, timeLimitSec: 180, energyMultiplier: 2.2,
  },
  {
    id: 'level_31',
    name: 'Circuit Reverie',
    spawnWeights: { die:47, sphere:3, ice:1, lock:2, wild:3, bomb:1, rainbow_bomb:1, mirror:0, stone:1, multiplier_orb:5, ghost:5, catalyst:7 },
    winScore: 790_000, timeLimitSec: 180, energyMultiplier: 2.3,
  },
  {
    id: 'level_32',
    name: 'Static Cascade',
    spawnWeights: { die:45, sphere:3, ice:1, lock:2, wild:4, bomb:1, rainbow_bomb:1, mirror:0, stone:1, multiplier_orb:5, ghost:5, catalyst:7 },
    winScore: 835_000, timeLimitSec: 150, energyMultiplier: 2.3,
  },
  {
    id: 'level_33',
    name: 'Overclock Spire',
    spawnWeights: { die:43, sphere:3, ice:1, lock:2, wild:4, bomb:1, rainbow_bomb:1, mirror:0, stone:1, multiplier_orb:6, ghost:6, catalyst:8 },
    winScore: 880_000, timeLimitSec: 150, energyMultiplier: 2.4,
  },
  {
    id: 'level_34',
    name: 'Sovereign Grid',
    spawnWeights: { die:40, sphere:3, ice:1, lock:2, wild:4, bomb:2, rainbow_bomb:1, mirror:0, stone:1, multiplier_orb:6, ghost:6, catalyst:8 },
    winScore: 930_000, timeLimitSec: 120, energyMultiplier: 2.4,
  },
];

// ── World 4: Horror Membrane (levels 35-42) ───────────────────────────────────
// Rainbow bombs ambush entire columns. Ghost packs compound on farkle.
// Obsidian density (lock+stone) forces narrow chain corridors.
const WORLD_4: LevelDef[] = [
  {
    id: 'level_35',
    name: 'Horror Threshold',
    spawnWeights: { die:48, sphere:3, ice:1, lock:3, wild:1, bomb:2, rainbow_bomb:1, mirror:0, stone:3, multiplier_orb:4, ghost:6, catalyst:5 },
    winScore: 970_000, timeLimitSec: 180, energyMultiplier: 2.4,
  },
  {
    id: 'level_36',
    name: 'Obsidian Membrane',
    spawnWeights: { die:46, sphere:3, ice:1, lock:3, wild:1, bomb:2, rainbow_bomb:1, mirror:0, stone:4, multiplier_orb:4, ghost:7, catalyst:5 },
    winScore: 1_015_000, timeLimitSec: 180, energyMultiplier: 2.5,
  },
  {
    id: 'level_37',
    name: 'Fracture Bloom',
    spawnWeights: { die:44, sphere:3, ice:1, lock:3, wild:2, bomb:2, rainbow_bomb:2, mirror:0, stone:4, multiplier_orb:4, ghost:7, catalyst:5 },
    winScore: 1_065_000, timeLimitSec: 150, energyMultiplier: 2.5,
  },
  {
    id: 'level_38',
    name: 'Abyssal Core',
    spawnWeights: { die:42, sphere:3, ice:1, lock:4, wild:2, bomb:2, rainbow_bomb:2, mirror:0, stone:4, multiplier_orb:4, ghost:8, catalyst:5 },
    winScore: 1_120_000, timeLimitSec: 150, energyMultiplier: 2.6,
  },
  {
    id: 'level_39',
    name: 'Void Collapse',
    spawnWeights: { die:40, sphere:3, ice:2, lock:4, wild:2, bomb:2, rainbow_bomb:2, mirror:0, stone:4, multiplier_orb:4, ghost:8, catalyst:6 },
    winScore: 1_180_000, timeLimitSec: 150, energyMultiplier: 2.6,
  },
  {
    id: 'level_40',
    name: 'Crimson Wellspring',
    spawnWeights: { die:38, sphere:3, ice:2, lock:4, wild:2, bomb:2, rainbow_bomb:3, mirror:0, stone:4, multiplier_orb:4, ghost:8, catalyst:6 },
    winScore: 1_245_000, timeLimitSec: 120, energyMultiplier: 2.7,
  },
  {
    id: 'level_41',
    name: 'Entropy Maw',
    spawnWeights: { die:36, sphere:3, ice:2, lock:5, wild:2, bomb:2, rainbow_bomb:3, mirror:0, stone:5, multiplier_orb:4, ghost:8, catalyst:6 },
    winScore: 1_315_000, timeLimitSec: 120, energyMultiplier: 2.7,
  },
  {
    id: 'level_42',
    name: 'Final Disruption',
    spawnWeights: { die:33, sphere:3, ice:2, lock:5, wild:3, bomb:2, rainbow_bomb:3, mirror:0, stone:5, multiplier_orb:4, ghost:8, catalyst:7 },
    winScore: 1_390_000, timeLimitSec: 90, energyMultiplier: 2.8,
  },
];

// ── World 5: Casino Sanctum (levels 43-50) ───────────────────────────────────
// All systems simultaneously active. Maximum volatility. Each chain carries
// compounding multipliers, shard windows, and slipstream pressure.
// Wild dice and ghost packs reach peak density. No ceiling.
const WORLD_5: LevelDef[] = [
  {
    id: 'level_43',
    name: 'Casino Atrium',
    spawnWeights: { die:38, sphere:3, ice:1, lock:3, wild:3, bomb:2, rainbow_bomb:2, mirror:0, stone:3, multiplier_orb:6, ghost:6, catalyst:6 },
    winScore: 1_450_000, timeLimitSec: 180, energyMultiplier: 2.8,
  },
  {
    id: 'level_44',
    name: 'Fortune Spire',
    spawnWeights: { die:36, sphere:3, ice:1, lock:3, wild:3, bomb:2, rainbow_bomb:2, mirror:0, stone:3, multiplier_orb:6, ghost:7, catalyst:6 },
    winScore: 1_520_000, timeLimitSec: 180, energyMultiplier: 2.8,
  },
  {
    id: 'level_45',
    name: 'Void Stakes',
    spawnWeights: { die:34, sphere:3, ice:1, lock:3, wild:4, bomb:2, rainbow_bomb:2, mirror:0, stone:3, multiplier_orb:6, ghost:7, catalyst:7 },
    winScore: 1_600_000, timeLimitSec: 150, energyMultiplier: 2.9,
  },
  {
    id: 'level_46',
    name: 'Heist Horizon',
    spawnWeights: { die:32, sphere:3, ice:1, lock:4, wild:4, bomb:2, rainbow_bomb:3, mirror:0, stone:3, multiplier_orb:6, ghost:7, catalyst:7 },
    winScore: 1_690_000, timeLimitSec: 150, energyMultiplier: 2.9,
  },
  {
    id: 'level_47',
    name: 'Grand Frenzy',
    spawnWeights: { die:30, sphere:3, ice:1, lock:4, wild:4, bomb:3, rainbow_bomb:3, mirror:0, stone:4, multiplier_orb:6, ghost:8, catalyst:7 },
    winScore: 1_785_000, timeLimitSec: 120, energyMultiplier: 3.0,
  },
  {
    id: 'level_48',
    name: 'Neural Jackpot',
    spawnWeights: { die:28, sphere:3, ice:1, lock:4, wild:4, bomb:3, rainbow_bomb:3, mirror:0, stone:4, multiplier_orb:6, ghost:8, catalyst:8 },
    winScore: 1_890_000, timeLimitSec: 120, energyMultiplier: 3.0,
  },
  {
    id: 'level_49',
    name: 'Obsidian Vault',
    spawnWeights: { die:26, sphere:3, ice:2, lock:5, wild:4, bomb:3, rainbow_bomb:3, mirror:0, stone:4, multiplier_orb:6, ghost:8, catalyst:8 },
    winScore: 1_950_000, timeLimitSec: 90, energyMultiplier: 3.0,
  },
  {
    id: 'level_50',
    name: 'Infinite Cascade',
    spawnWeights: { die:24, sphere:3, ice:2, lock:5, wild:5, bomb:3, rainbow_bomb:4, mirror:0, stone:4, multiplier_orb:6, ghost:8, catalyst:8 },
    winScore: 2_000_000, timeLimitSec: null, energyMultiplier: 3.0,
  },
];

export const LEVELS_EXPANDED: LevelDef[] = [
  ...LEVELS,
  ...WORLD_1,
  ...WORLD_2,
  ...WORLD_3,
  ...WORLD_4,
  ...WORLD_5,
];

// Validate on module load — fails fast at startup if any level is misconfigured.
assertLevelsValid(LEVELS_EXPANDED);

export function getLevelById(id: string): LevelDef | undefined {
  return LEVELS_EXPANDED.find(l => l.id === id);
}

export function getLevelByIndex(index: number): LevelDef {
  return LEVELS_EXPANDED[index] ?? LEVELS_EXPANDED[0]!;
}

export function getNextLevel(currentId: string): LevelDef | null {
  const idx = LEVELS_EXPANDED.findIndex(l => l.id === currentId);
  return idx >= 0 && idx < LEVELS_EXPANDED.length - 1 ? LEVELS_EXPANDED[idx + 1]! : null;
}
