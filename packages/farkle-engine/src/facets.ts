// ═══════════════════════════════════════════════════════════════════════════
// facets.ts — I: FACET MODIFIERS / ROGUELIKE GENRE  (L4 Wrapper)
// ═══════════════════════════════════════════════════════════════════════════
//
// POSITION IN GAME LOOP:
//   processChain: applyFacetToScore is called first in the L4 pipeline.
//
// WHAT THIS MODULE DOES:
//   Draft-based per-round modifier. Between rounds (after each bank) the
//   active player sees 3 facet choices generated from a seeded shuffle.
//   Choosing a facet equips it for subsequent chains until replaced.
//   After 3 non-farkle rounds, the equipped facet mutates to Tier 2
//   (stats boosted by ~20%).
//
//   All 8 facets are post-Sacred-Core score wrappers; they never affect dice
//   selection or face distribution. RTP bounded by pipeline RULE B (6×).
//
// DRAFT FLOW:
//   handleBank/processChain → startFacetDraft() → broadcast DRAFT_START
//   → client shows DraftPanel → player sends PICK_FACET | SKIP_DRAFT
//   → server calls pickFacet() / skipFacetDraft() → stores equipped facet
//   → next chain: applyFacetToScore() applied post-Event-Horizon
//
// RULE E (from spec): "Facet mutation requires 3 active rounds AND
//   non-Farkle survival."
// ═══════════════════════════════════════════════════════════════════════════

export type FacetId =
  | 'GAMBLER' | 'CRESCENDO' | 'WILDFIRE' | 'IRONCLAD'
  | 'VORTEX' | 'PHANTOM' | 'ECHO' | 'SURGE';

export interface FacetContext {
  banked: number;
  isFrenzy: boolean;
  chainLength: number;
  faces: number[];           // DieFace values in this chain
  consecutiveBanks: number;  // Event Horizon streak value
}

export interface FacetDef {
  id: FacetId;
  name: string;
  description: string;
  t2description: string;     // Tier 2 (mutated) description
  apply: (score: number, ctx: FacetContext, tier: 1 | 2) => number;
}

export interface FacetState {
  equipped: FacetId | null;
  roundsActive: number;   // non-farkle rounds with current facet; mutation triggers at 3
  tier: 1 | 2;
  draftPending: boolean;  // server has started a draft; client should show DraftPanel
  draftOptions: FacetId[];
}

export const INITIAL_FACET_STATE: FacetState = {
  equipped: null, roundsActive: 0, tier: 1, draftPending: false, draftOptions: [],
};

export const FACET_POOL: FacetDef[] = [
  {
    id: 'GAMBLER',
    name: 'GAMBLER',
    description: 'Score ≥300 → ×1.5 · Score <300 → ×0.85',
    t2description: 'Score ≥200 → ×1.7 · Score <200 → ×0.90',
    apply: (s, _ctx, tier) => {
      const threshold = tier === 2 ? 200 : 300;
      const highMult  = tier === 2 ? 1.7  : 1.5;
      const lowMult   = tier === 2 ? 0.90 : 0.85;
      return s >= threshold ? Math.round(s * highMult) : Math.round(s * lowMult);
    },
  },
  {
    id: 'CRESCENDO',
    name: 'CRESCENDO',
    description: 'Frenzy chains → ×1.3',
    t2description: 'Frenzy chains → ×1.55',
    apply: (s, ctx, tier) => {
      const mult = tier === 2 ? 1.55 : 1.3;
      return ctx.isFrenzy ? Math.round(s * mult) : s;
    },
  },
  {
    id: 'WILDFIRE',
    name: 'WILDFIRE',
    description: 'Chain includes a 1-face die → +200',
    t2description: 'Chain includes a 1-face die → +350',
    apply: (s, ctx, tier) => {
      const bonus = tier === 2 ? 350 : 200;
      return ctx.faces.includes(1) ? s + bonus : s;
    },
  },
  {
    id: 'IRONCLAD',
    name: 'IRONCLAD',
    description: 'Comeback (banked <2000) → ×1.4',
    t2description: 'Comeback (banked <3500) → ×1.6',
    apply: (s, ctx, tier) => {
      const cap  = tier === 2 ? 3500 : 2000;
      const mult = tier === 2 ? 1.6  : 1.4;
      return ctx.banked < cap ? Math.round(s * mult) : s;
    },
  },
  {
    id: 'VORTEX',
    name: 'VORTEX',
    description: 'Max-chain (6 dice) → ×2.0',
    t2description: 'Max-chain (6 dice) → ×2.5',
    apply: (s, ctx, tier) => {
      const mult = tier === 2 ? 2.5 : 2.0;
      return ctx.chainLength === 6 ? Math.round(s * mult) : s;
    },
  },
  {
    id: 'PHANTOM',
    name: 'PHANTOM',
    description: 'Every 4th consecutive bank → +500 phantom',
    t2description: 'Every 3rd consecutive bank → +700 phantom',
    apply: (s, ctx, tier) => {
      const every = tier === 2 ? 3 : 4;
      const bonus = tier === 2 ? 700 : 500;
      return ctx.consecutiveBanks > 0 && ctx.consecutiveBanks % every === 0 ? s + bonus : s;
    },
  },
  {
    id: 'ECHO',
    name: 'ECHO',
    description: 'Score >500 → ×1.35',
    t2description: 'Score >400 → ×1.5',
    apply: (s, _ctx, tier) => {
      const threshold = tier === 2 ? 400 : 500;
      const mult      = tier === 2 ? 1.5  : 1.35;
      return s > threshold ? Math.round(s * mult) : s;
    },
  },
  {
    id: 'SURGE',
    name: 'SURGE',
    description: '+0.10× per consecutive bank (cap ×1.5)',
    t2description: '+0.14× per consecutive bank (cap ×1.7)',
    apply: (s, ctx, tier) => {
      const gain = tier === 2 ? 0.14 : 0.10;
      const cap  = tier === 2 ? 1.7  : 1.5;
      return Math.round(s * Math.min(cap, 1.0 + ctx.consecutiveBanks * gain));
    },
  },
];

export const FACET_MAP = new Map<FacetId, FacetDef>(FACET_POOL.map(f => [f.id, f]));

export function applyFacetToScore(score: number, state: FacetState, ctx: FacetContext): number {
  if (!state.equipped) return score;
  const def = FACET_MAP.get(state.equipped);
  return def ? def.apply(score, ctx, state.tier) : score;
}

// Deterministic facet draft — 3 unique choices from pool using LCG seed.
export function generateDraftOptions(seed: number): FacetId[] {
  const pool = FACET_POOL.map(f => f.id) as FacetId[];
  let s = seed >>> 0;
  for (let i = pool.length - 1; i > 0; i--) {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    const j = s % (i + 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, 3);
}

export function startFacetDraft(state: FacetState, seed: number): FacetState {
  return { ...state, draftPending: true, draftOptions: generateDraftOptions(seed) };
}

export function pickFacet(state: FacetState, id: FacetId): FacetState {
  return { ...state, equipped: id, roundsActive: 0, tier: 1, draftPending: false, draftOptions: [] };
}

export function skipFacetDraft(state: FacetState): FacetState {
  return { ...state, draftPending: false, draftOptions: [] };
}

// Called at ROUND_END. Non-farkle rounds increment roundsActive; mutation fires at 3.
export function tickFacetRound(state: FacetState, didFarkle: boolean): FacetState {
  if (didFarkle || !state.equipped) return state;
  const next = state.roundsActive + 1;
  const tier: 1 | 2 = next >= 3 && state.tier === 1 ? 2 : state.tier;
  return { ...state, roundsActive: next, tier };
}
