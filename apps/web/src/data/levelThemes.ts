// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

// Training-data art direction:
//   Gothic:674, Neural:591, Neon:575, Void:417, SkelGold:357
//   Casino:181, Obsidian:177, Farkle:144, Cyberpunk:142
//   Horror:123, Roguelike:109, Rhythm:105
// Accent colors derived from corpus motif vocabulary and OV1 design_tokens.
// ERK states map to unified_lattice genreModule emotionalWeights.

export type ErkState = 'calm' | 'melancholic' | 'tense' | 'euphoric';

export interface LevelTheme {
  levelId: string;
  introText: string;
  erkState: ErkState;
  accentColor: string;
  milestones: number[];  // fractions of winScore e.g. [0.25, 0.5, 0.75]
}

export const LEVEL_THEMES: LevelTheme[] = [
  {
    levelId: 'level_01',
    introText: 'Chain dice into combos. Bank your score before the Frenzy drains.',
    erkState: 'calm',
    accentColor: '#00e5ff',   // Neural Neon — 591 corpus occurrences
    milestones: [0.25, 0.5, 0.75],
  },
  {
    levelId: 'level_02',
    introText: 'Multiplier orbs boost your next commit. Tap spheres for energy.',
    erkState: 'calm',
    accentColor: '#c8d400',   // Neon acid-lime — Neon:575
    milestones: [0.25, 0.5, 0.75],
  },
  {
    levelId: 'level_03',
    introText: 'Ice blocks freeze dice. Chain around them or thaw with adjacency.',
    erkState: 'melancholic',
    accentColor: '#7b2fff',   // Void purple — Void:417
    milestones: [0.25, 0.5, 0.75],
  },
  {
    levelId: 'level_04',
    introText: 'Stone drops bioSteel shards when destroyed. Time is running out.',
    erkState: 'melancholic',
    accentColor: '#e8d5a3',   // Skeletal gold — SkelGold:357
    milestones: [0.25, 0.5, 0.75],
  },
  {
    levelId: 'level_05',
    introText: 'Locks take hits from column commits. Catalysts boost wild spawns.',
    erkState: 'tense',
    accentColor: '#c9a84c',   // Gothic ritual gold — Gothic:674
    milestones: [0.25, 0.5, 0.75],
  },
  {
    levelId: 'level_06',
    introText: 'Catalyst chains compound wild spawns. Plan your column pressure.',
    erkState: 'tense',
    accentColor: '#404040',   // Obsidian deep — Obsidian:177
    milestones: [0.25, 0.5, 0.75],
  },
  {
    levelId: 'level_07',
    introText: 'Ghost dice drift freely. Tap to anchor. Multipliers accelerate fast.',
    erkState: 'tense',
    accentColor: '#ff7200',   // Cyberpunk amber — Cyberpunk:142
    milestones: [0.25, 0.5, 0.75],
  },
  {
    levelId: 'level_08',
    introText: 'Rainbow bombs clear the dominant face. Ghosts hunt in packs.',
    erkState: 'tense',
    accentColor: '#ff2244',   // Horror red — Horror:123
    milestones: [0.25, 0.5, 0.75],
  },
  {
    levelId: 'level_09',
    introText: 'Wilds mutate chains. Roguelike facets shift the rules every stage.',
    erkState: 'melancholic',
    accentColor: '#00ff66',   // Roguelike mutation green — Roguelike:109
    milestones: [0.25, 0.5, 0.75],
  },
  {
    levelId: 'level_10',
    introText: 'Maximum entropy. Every system active. Survive the Obsidian Lattice.',
    erkState: 'euphoric',
    accentColor: '#cc44ff',   // Obsidian violet peak — face-6 neon
    milestones: [0.25, 0.5, 0.75],
  },
];

export function getLevelTheme(levelId: string): LevelTheme {
  return LEVEL_THEMES.find(t => t.levelId === levelId) ?? LEVEL_THEMES[0]!;
}
