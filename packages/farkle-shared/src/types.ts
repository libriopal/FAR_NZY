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

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

// ── Voxel entity types ────────────────────────────────────────────────────────

export type EntityType =
  | 'die'            // standard face 1–6 scoring die
  | 'sphere'         // green NRG orb — tap: +8 energy, removed
  | 'ice'            // frozen die — unchainable; thaws to die on adjacent commit
  | 'lock'           // locked die 1–3 HP — damaged by commits in same column; 0 HP → die
  | 'wild'           // wild die — chains as any face; adopts plurality value at commit
  | 'bomb'           // standard bomb — tap: blast ±1 col ±1.5Y; pts per entity type
  | 'rainbow_bomb'   // rainbow bomb — tap: clears all dice of most common face
  | 'mirror'         // mirror die — chains normally; face = opposite of its chain neighbor
  | 'stone'          // stone block 3 HP — unchainable; only bombs damage it; drops bioSteel
  | 'multiplier_orb' // blue-gold sphere — tap: next commit ×1.5 bonus; single use
  | 'ghost'          // ghost die — ignores column constraint; drifts; tap to anchor → die
  | 'catalyst';      // catalyst block — committed in chain: +2% Wild spawn weight (max +10%)

export interface SpawnWeights {
  die: number;
  sphere: number;
  ice: number;
  lock: number;
  wild: number;
  bomb: number;
  rainbow_bomb: number;
  mirror: number;
  stone: number;
  multiplier_orb: number;
  ghost: number;
  catalyst: number;
}

// All weights sum to 100. Escalates specials progressively through modes.
export const SPAWN_WEIGHTS: Record<'NORMAL' | 'PRIME' | 'FRENZY', SpawnWeights> = {
  NORMAL: { die:62, sphere:25, ice:1,  lock:0, wild:0, bomb:0, rainbow_bomb:0, mirror:4, stone:4, multiplier_orb:3, ghost:1, catalyst:0 },
  PRIME:  { die:52, sphere:18, ice:6,  lock:3, wild:2, bomb:1, rainbow_bomb:0, mirror:6, stone:5, multiplier_orb:4, ghost:2, catalyst:1 },
  FRENZY: { die:39, sphere:12, ice:6,  lock:4, wild:9, bomb:7, rainbow_bomb:1, mirror:7, stone:5, multiplier_orb:5, ghost:3, catalyst:2 },
} as const;

export const BOMB_CONSTANTS = {
  STANDARD_RADIUS: 1,  // column spread for 3×3 tile pattern
  SELF_PTS: 25,        // points for detonating the bomb itself
  DIE_PTS_ONE: 100,    // blast reward for face=1 die (Farkle-consistent)
  DIE_PTS_FIVE: 50,    // blast reward for face=5 die (Farkle-consistent)
  LOCK_PTS: 50,
  WILD_PTS: 75,
  MIRROR_PTS: 30,
  STONE_PTS: 50,       // aligned with GAME_CONSTANTS.BOMB_STONE_PTS
  CATALYST_PTS: 40,
  SPHERE_ENERGY: 20,
  MULTIPLIER_ORB_ENERGY: 15,
} as const;

export const MIRROR_OPPOSITES: Record<number, number> = { 1:6, 2:5, 3:4, 4:3, 5:2, 6:1 } as const;

export interface LevelDef {
  id: string;
  name: string;
  spawnWeights: SpawnWeights;
  winScore: number;
  timeLimitSec: number | null;
  energyMultiplier: number;
}
export const CATALYST_WILD_BOOST = 2;   // percent per catalyst committed
export const CATALYST_MAX_BOOST  = 10;  // maximum total boost from catalysts

export type DieColor = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'PURPLE';

export type BlockerType = 'STONE' | 'ICE' | 'LOCK';

export type DisruptionType = 'ice_send' | 'lock_send' | 'scramble';

export interface DisruptionEvent {
  id: string;
  type: DisruptionType;
  fromPlayerId: string;
  targetColumns: number[];
  receivedAt: number;
}

export interface DoublerCell {
  column: number;
  active: boolean;
  expiresAt: number;
}

export type CellState = 'NORMAL' | 'EMPTY' | 'SPAWNING' | 'FROZEN' | 'LOCKED' | 'WILD';

export type GamePhase =
  | 'IDLE' | 'CHAINING' | 'RESOLVING' | 'REFILLING'
  | 'BOMB_FUSE' | 'FARKLE_ANIM' | 'REACTION' | 'GAME_OVER';

export type GameMode =
  | 'SOLO_FREE' | 'SOLO_CASINO'
  | 'VS_FREE' | 'VS_CASINO'
  | 'RALLY_FREE' | 'RALLY_CASINO'
  | 'HEIST_FREE' | 'HEIST_CASINO';

export type CurrencyMode = 'FD' | 'PDX';

export type RallyRole = 'RAINMAKER' | 'HEADHUNTER' | 'ARCHIVIST' | 'CONDUCTOR';

export type ReactionVote = 'UP' | 'DOWN' | null;

export interface Cell {
  id: string;
  face: DieFace | null;
  type: DieColor | BlockerType | 'BOMB_STANDARD' | 'BOMB_RAINBOW' | 'NONE';
  state: CellState;
  health?: number;
  fuseMs?: number;
  fuseColor?: DieColor;
}

export interface GridPos { row: number; col: number; }

export interface ChainResult {
  score: number;
  scaledScore: number;
  isFarkle: boolean;
  combo: string;
  triggersBomb: null | 'BOMB_STANDARD' | 'BOMB_RAINBOW';
}

export interface ScorePopup {
  id: string; row: number; col: number;
  score: number; label: string;
  color: 'green' | 'red' | 'gold';
}

export interface GameState {
  phase: GamePhase;
  grid: Cell[][];
  banked: number;
  unbanked: number;
  multiplierStep: number;
  consecutiveChains: number;
  popups: ScorePopup[];
  farklePool: number;
  lastChainResult: ChainResult | null;
}

export interface Player {
  id: string; name: string; banked: number;
  role?: RallyRole; isActive: boolean;
  vote: ReactionVote; isConnected: boolean;
}

export interface LobbySettings {
  mode: GameMode;
  playerCount: 1 | 2 | 3 | 4;
  turnTimerSeconds: 10 | 15 | 20;
  blockerDensity: 'LOW' | 'MEDIUM' | 'HIGH';
  threeOnesScore: 1000 | 300;
  singleOneScore: number;
  rainbowRedReward: number;
  currencyMode: CurrencyMode;
  stakeAmount: number;
  rainbowBlueReward: number;
}

export const GAME_CONSTANTS = {
  gridRows: 7, gridCols: 7, bombFuseMs: 3000,
  maxChainLength: 6, minChainLength: 2, cascadeMs: 80,
  MAX_CHAIN: 6, STONE_HP: 2, BOMB_RADIUS: 1,
  BOMB_STONE_PTS: 50, BOMB_DIE_PTS: 100,
  FUSE_MS: 3000, ARCHIVIST_PCT: 0.15
} as const;

export const RALLY_MILESTONES = [
  { tier: 1, points: 10000, multiplier: 0.5 },
  { tier: 2, points: 25000, multiplier: 1.0 },
  { tier: 3, points: 50000, multiplier: 2.0 },
  { tier: 4, points: 100000, multiplier: 5.0 }
] as const;

export const FACE_TO_COLOR: Record<DieFace, DieColor> = {
  1: 'RED', 2: 'ORANGE', 3: 'YELLOW', 4: 'GREEN', 5: 'BLUE', 6: 'PURPLE'
};

export const COLOR_TO_TAILWIND: Record<DieColor, string> = {
  RED: 'bg-rose-500', ORANGE: 'bg-orange-500', YELLOW: 'bg-amber-400',
  GREEN: 'bg-emerald-500', BLUE: 'bg-sky-500', PURPLE: 'bg-violet-600'
};

export const MULTIPLIER_LADDER: readonly number[] = [1.0, 1.25, 1.5, 2.0, 3.0, 4.0] as const;

export function getMultiplier(step: number): number {
  return MULTIPLIER_LADDER[Math.min(step, MULTIPLIER_LADDER.length - 1)] ?? 1.0;
}

export function multiplayerGridSize(playerCount: number): number {
  if (playerCount <= 1) return 7;
  if (playerCount === 2) return 8;
  if (playerCount === 3) return 9;
  return 10;
}

export const HEIST_CONSTANTS = {
  VAULT_SPLIT: 0.70,       // 70% of score goes to vault, 30% to banked
  VAULT_THRESHOLD: 5000,   // vault must reach this to trigger heist
  HEIST_ENERGY_COST: 50,   // energy cost to initiate a heist
  HEIST_WINDOW_MS: 5000,   // teammates have 5s to block a heist
} as const;

export const FD_COLORS = {
  badge: 'bg-violet-900 border-violet-500 text-sky-300',
  bg: '#7C3AED',
  accent: '#93C5FD',
  muted: '#D1D5DB',
} as const;

export const PDX_COLORS = {
  badge: 'bg-emerald-950 border-emerald-500 text-amber-400',
  bg: '#10B981',
  accent: '#1D4ED8',
  gold: '#F59E0B',
} as const;

export const FD_ASCII_ICON = '✦░▒▓';
export const PDX_ASCII_ICON = '◆';

export const PDX_USD_RATE = 1 as const;
export const FD_HAS_MONETARY_VALUE = false as const;

export const DAILY_PDX_BONUS = 10 as const;

export const DEFAULT_SETTINGS: LobbySettings = {
  mode: 'SOLO_FREE',
  playerCount: 1,
  turnTimerSeconds: 10,
  blockerDensity: 'MEDIUM',
  threeOnesScore: 1000,
  singleOneScore: 100,
  currencyMode: 'FD',
  stakeAmount: 0,
  rainbowRedReward: 100,
  rainbowBlueReward: 50,
};

export interface RTPConfig {
  mode?: GameMode;
  targetRTP: number;
  platformFee: number;
  poolSize: number;
  bonusSpawnRates?: {
    multiplierOrb?: number;
    bomb?: number;
    rainbowBomb?: number;
  };
  roleEffects?: Partial<Record<RallyRole, boolean>>;
  varianceTarget?: 'LOW' | 'MEDIUM' | 'HIGH';
  milestoneConfig?: ReadonlyArray<{ tier: number; points: number; multiplier: number }>;
}

export interface OWCConfig {
  enabled: boolean;
  playerRank: number;
  playerCount: number;
  /** Preview/endpoint use only; monteCarlo simulation uses the actual turn counter. Defaults to 10 when omitted. */
  turnsElapsed?: number;
  targetRTP?: number;
}

export type TransactionType =
  | 'FD_PURCHASE' | 'PDX_GIFT' | 'FD_WAGER' | 'PDX_WAGER'
  | 'FD_AWARD' | 'PDX_AWARD' | 'PDX_DAILY_BONUS' | 'PDX_REDEEM' | 'PDX_PROMO';

export interface WalletTransaction {
  id: string;
  type: TransactionType;
  currency: CurrencyMode;
  amount: number;
  balanceAfter: number;
  timestamp: string;
  sessionId?: string;
  notes?: string;
}

export interface PlayerWallet {
  fd: number;
  pdx: number;
  pdxPlaythroughTotal: number;
  pdxPlaythroughRequired: number;
  lastDailyBonus: string;
}

export const DEFAULT_WALLET: PlayerWallet = {
  fd: 1000,
  pdx: 0,
  pdxPlaythroughTotal: 0,
  pdxPlaythroughRequired: 100,
  lastDailyBonus: ''
};

export const PDX_PLAYTHROUGH_RATE = 10 as const;
export const FD_TO_PDX_GIFT_RATE = 0.01 as const;

export interface WalletState {
  fd: number;
  pdx: number;
}

export type EnergyMode = 'PRIME' | 'FRENZY';

export interface EnergyState {
  energy: number;
  mode: EnergyMode;
  anchorPlayerId: string | null;
}

export const ENERGY_CONSTANTS = {
  MAX: 300,
  FRENZY_THRESHOLD: 150,
} as const;

export type UsernameColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';

export interface UserProfile {
  id: string;
  username: string;
  color: UsernameColor;
  asciiArt: string;
  createdAt: string;
  passwordHash: string;
  isGuest: boolean;
  isAdmin?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  encryptedContent: string;
  iv: string;
  timestamp: number;
}

export const USERNAME_COLOR_HEX: Record<UsernameColor, string> = {
  red: '#f43f5e', orange: '#f97316', yellow: '#fbbf24',
  green: '#10b981', blue: '#38bdf8', purple: '#7c3aed'
};


export interface DecisionContext {
  decision: 'BANK' | 'CONTINUE' | 'PASS';
  unbanked: number;
  multiplierStep: number;
  chainNumber: number;
}
