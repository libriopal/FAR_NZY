// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

// World taxonomy derived from corpus genre distribution:
//   Gothic:674, Neural:591, Neon:575, Void:417, SkelGold:357
//   Casino:181, Obsidian:177, Cyberpunk:142, Horror:123, Roguelike:109, Rhythm:105
//
// World 0: Neural/Neon Tutorial (levels 01-10)  — existing prologue
// World 1: Gothic Cathedral    (levels 11-18)  — lock/stone escalation
// World 2: Void Dreamscape     (levels 19-26)  — mirror/ice/ghost surrealism
// World 3: Cyberpunk Overmind  (levels 27-34)  — catalyst/multiplier tempo
// World 4: Horror Membrane     (levels 35-42)  — rainbow_bomb/ghost/obsidian
// World 5: Casino Sanctum      (levels 43-50)  — all systems, max volatility

import type { ErkState } from './levelThemes.js';

export interface WorldDef {
  worldId: string;
  worldName: string;
  genre: string;
  accentColor: string;
  erkState: ErkState;
  levelRange: [number, number]; // inclusive first/last level number
  unlockAfterLevelId: string | null; // null = always unlocked
}

export const WORLDS: WorldDef[] = [
  {
    worldId: 'world_00',
    worldName: 'Neural Foyer',
    genre: 'Neural/Neon',
    accentColor: '#00e5ff',
    erkState: 'calm',
    levelRange: [1, 10],
    unlockAfterLevelId: null,
  },
  {
    worldId: 'world_01',
    worldName: 'Gothic Cathedral',
    genre: 'Gothic',
    accentColor: '#c9a84c',
    erkState: 'melancholic',
    levelRange: [11, 18],
    unlockAfterLevelId: 'level_10',
  },
  {
    worldId: 'world_02',
    worldName: 'Void Dreamscape',
    genre: 'Void/SkelGold',
    accentColor: '#7b2fff',
    erkState: 'melancholic',
    levelRange: [19, 26],
    unlockAfterLevelId: 'level_18',
  },
  {
    worldId: 'world_03',
    worldName: 'Cyberpunk Overmind',
    genre: 'Cyberpunk/Neural',
    accentColor: '#ff7200',
    erkState: 'tense',
    levelRange: [27, 34],
    unlockAfterLevelId: 'level_26',
  },
  {
    worldId: 'world_04',
    worldName: 'Horror Membrane',
    genre: 'Horror/Obsidian',
    accentColor: '#ff2244',
    erkState: 'tense',
    levelRange: [35, 42],
    unlockAfterLevelId: 'level_34',
  },
  {
    worldId: 'world_05',
    worldName: 'Casino Sanctum',
    genre: 'Casino/Farkle',
    accentColor: '#ffd700',
    erkState: 'euphoric',
    levelRange: [43, 50],
    unlockAfterLevelId: 'level_42',
  },
];

export function getWorldForLevel(levelNum: number): WorldDef {
  return WORLDS.find(w => levelNum >= w.levelRange[0] && levelNum <= w.levelRange[1]) ?? WORLDS[0]!;
}
