// ─── Core Item Types ──────────────────────────────────────────────────────────

export type ItemCategory = 'structural' | 'organic' | 'hybrid';

export type ItemModifier =
  | { type: 'frozen'; turnsRemaining: number }
  | { type: 'locked'; scaffoldCount: number }
  | { type: 'overgrowth'; spreadRadius: number; turnsToSpread: number };

export interface GameItem {
  id: string;
  definitionId: string;
  category: ItemCategory;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  modifiers: ItemModifier[];
  physicsBodyHandle: number | null;
  inTray: boolean;
  traySlotIndex: number | null;
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  meshKey: string;
  textureKey: string;
  physicsShape: 'box' | 'sphere' | 'capsule' | 'convex';
  physicsScale: { x: number; y: number; z: number };
  mass: number;
  restitution: number;
  friction: number;
  matchValue: number;
  resourceRewards: Partial<Record<'bioSteel' | 'aeroSeeds', number>>;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
}

// ─── Tray Types ───────────────────────────────────────────────────────────────

export interface TraySlot {
  index: number;
  item: GameItem | null;
  reservedFor: string | null;
}

// ─── Match Types ──────────────────────────────────────────────────────────────

export interface MatchResult {
  definitionId: string;
  itemIds: [string, string, string];
  slotIndices: [number, number, number];
  scoreValue: number;
  resourceReward: Partial<Record<'bioSteel' | 'aeroSeeds', number>>;
  timestamp: number;
}

// ─── Objective Types ──────────────────────────────────────────────────────────

export interface ObjectiveConfig {
  id: string;
  type: 'match_count' | 'match_category' | 'match_specific' | 'score_target' | 'time_limit';
  target: number;
  definitionId?: string;
  category?: ItemCategory;
  label: string;
}

export interface ObjectiveState {
  config: ObjectiveConfig;
  current: number;
  completed: boolean;
}

// ─── Level / Spawn Types ──────────────────────────────────────────────────────

export interface SpawnConfig {
  volumeMin: { x: number; y: number; z: number };
  volumeMax: { x: number; y: number; z: number };
  itemCount: number;
  itemPoolWeights: Array<{ definitionId: string; weight: number }>;
  modifierConfig: {
    frozenProbability: number;
    lockedProbability: number;
    overgrowthProbability: number;
  };
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  timerSeconds: number;
  spawnConfig: SpawnConfig;
  objectives: ObjectiveConfig[];
  backgroundKey: string;
  unlockRequirement: { type: 'level' | 'resource'; value: number | string };
}

// ─── Meta / Resource Types ────────────────────────────────────────────────────

export type ResourceType = 'bioSteel' | 'aeroSeeds' | 'goldCoins' | 'sweepsCoins';

export interface MetaResources {
  bioSteel: number;
  aeroSeeds: number;
  goldCoins: number;
  sweepsCoins: number;
}

export interface EstateUpgrade {
  id: string;
  name: string;
  tier: number;
  cost: Partial<MetaResources>;
  unlocks: string[];
  description: string;
  prerequisiteIds: string[];
}

// ─── Game State ───────────────────────────────────────────────────────────────

export interface GameState {
  phase: 'idle' | 'playing' | 'paused' | 'win' | 'lose';
  level: LevelConfig | null;
  items: Map<string, GameItem>;
  tray: TraySlot[];
  score: number;
  timeRemaining: number;
  objectives: ObjectiveState[];
  matchHistory: MatchResult[];
  sessionStartTime: number;
  comboCount: number;
}

// ─── Vector / Quaternion Helpers ──────────────────────────────────────────────

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}
