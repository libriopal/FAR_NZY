// ═══════════════════════════════════════════════════════════════════════════
// shards.ts — G: RULE SHARDS / ABSTRACT GENRE  (L4 Wrapper)
// ═══════════════════════════════════════════════════════════════════════════
//
// POSITION IN GAME LOOP:
//   processChain: applyActiveRuleShard is called after applyFacetToScore.
//
// WHAT THIS MODULE DOES:
//   Temporary scoring rules earned randomly on banks ≥ 300 (10% chance).
//   A player holds at most one shard at a time. Activating it starts the
//   30s hard timer (RULE D — no extension).
//
//   Earn flow:
//     handleBank → tryEarnShard() → if earned: broadcast SHARD_EARNED
//     → client shows RuleShardChip (pulsing, tap-to-activate)
//     → player taps → sends ACTIVATE_SHARD
//     → server activateShard() + broadcast SHARD_ACTIVATED
//
//   Every processChain call: tickShard() clears expired state.
//
// RULE D (from spec): "Rule Shards (Abstract) have hard 30s duration,
//   no extension."
// ═══════════════════════════════════════════════════════════════════════════

export type ShardId =
  | 'FEVER' | 'SURGE_SHARD' | 'UNDERDOG' | 'RESONANCE' | 'MOMENTUM' | 'ECHO_SHARD';

export interface ShardContext {
  isFrenzy: boolean;
  consecutiveBanks: number;
  chainLength: number;
}

export interface ShardDef {
  id: ShardId;
  name: string;
  description: string;
  apply: (score: number, ctx: ShardContext) => number;
}

export const SHARD_DURATION_MS = 30_000; // RULE D: immutable
export const SHARD_EARN_THRESHOLD = 300;
export const SHARD_EARN_CHANCE    = 0.10; // 10% probability

export interface RuleShardState {
  held:        ShardId | null;  // earned but not yet activated
  active:      ShardId | null;  // currently scoring
  activatedAt: number | null;   // epoch ms
  expiresAt:   number | null;   // epoch ms = activatedAt + 30000
}

export const INITIAL_SHARD_STATE: RuleShardState = {
  held: null, active: null, activatedAt: null, expiresAt: null,
};

export const SHARD_POOL: ShardDef[] = [
  {
    id: 'FEVER',
    name: 'FEVER',
    description: '×1.25 on every chain for 30s',
    apply: (s) => Math.round(s * 1.25),
  },
  {
    id: 'SURGE_SHARD',
    name: 'SURGE',
    description: '+250 flat on every scoring chain for 30s',
    apply: (s) => s > 0 ? s + 250 : s,
  },
  {
    id: 'UNDERDOG',
    name: 'UNDERDOG',
    description: 'Score ≤250 → ×2.5 · Score >250 → ×1.0',
    apply: (s) => s > 0 && s <= 250 ? Math.round(s * 2.5) : s,
  },
  {
    id: 'RESONANCE',
    name: 'RESONANCE',
    description: 'Frenzy → ×1.5 · Prime → ×1.0',
    apply: (s, ctx) => ctx.isFrenzy ? Math.round(s * 1.5) : s,
  },
  {
    id: 'MOMENTUM',
    name: 'MOMENTUM',
    description: '×(1 + streak×0.08) capped at ×1.4',
    apply: (s, ctx) => Math.round(s * Math.min(1.4, 1.0 + ctx.consecutiveBanks * 0.08)),
  },
  {
    id: 'ECHO_SHARD',
    name: 'ECHO',
    description: '3-die chains → ×2.0 · other → ×1.0',
    apply: (s, ctx) => ctx.chainLength === 3 ? Math.round(s * 2.0) : s,
  },
];

export const SHARD_MAP = new Map<ShardId, ShardDef>(SHARD_POOL.map(s => [s.id, s]));

export function applyActiveRuleShard(
  score: number,
  state: RuleShardState,
  ctx: ShardContext,
): number {
  if (!state.active || !state.expiresAt || Date.now() > state.expiresAt) return score;
  return SHARD_MAP.get(state.active)?.apply(score, ctx) ?? score;
}

export function activateShard(state: RuleShardState, id: ShardId): RuleShardState {
  const now = Date.now();
  return { held: null, active: id, activatedAt: now, expiresAt: now + SHARD_DURATION_MS };
}

// Call before each processChain — clears expired shards.
export function tickShard(state: RuleShardState): RuleShardState {
  if (state.active && state.expiresAt && Date.now() > state.expiresAt) {
    return { ...state, active: null, activatedAt: null, expiresAt: null };
  }
  return state;
}

// Returns a ShardId if the player earns one this bank, else null.
// rngVal: a [0,1) uniform float from the room CSPRNG (not Math.random).
export function tryEarnShard(
  bankGain: number,
  rngVal: number,
  currentHeld: ShardId | null,
): ShardId | null {
  if (currentHeld) return null; // already holding one
  if (bankGain < SHARD_EARN_THRESHOLD) return null;
  if (rngVal >= SHARD_EARN_CHANCE) return null;
  // Map rngVal in [0, SHARD_EARN_CHANCE) → shard index
  const pool = SHARD_POOL;
  const idx = Math.floor((rngVal / SHARD_EARN_CHANCE) * pool.length) % pool.length;
  return pool[idx]!.id;
}
