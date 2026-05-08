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

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { EntityType, DisruptionEvent, DoublerCell, RallyRole } from '@match3d/farkle-shared';

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_ENERGY = 300;
export const FRENZY_THRESHOLD = 150;
export const MAX_CHAIN = 6;
export const CHAIN6_ENERGY_GAIN = 10;
export const PRIME_CHAIN_ENERGY_COST = -10;
export const FRENZY_CHAIN_ENERGY_GAIN = 10;
export const FRENZY_CATCHUP_BONUS = 2;    // extra energy if energy < 75 in FRENZY
export const MULTIPLIER_LADDER = [1.0, 1.25, 1.5, 2.0, 3.0, 4.0] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnergyMode = 'NORMAL' | 'PRIME' | 'FRENZY';

export interface FarkleBody {
  id: string;
  type: 'die' | 'sphere'; // kept for backwards compat; prefer entityType
  entityType: EntityType;
  face: number | null;
  health: number;          // lock HP; 0 = unlocked
  column: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  inChain: boolean;
}

export interface FarkleGameState {
  energy: number;
  mode: EnergyMode;
  chain: string[];
  chainFaces: number[];
  chainScore: number;
  banked: number;
  unbanked: number;
  multiplierStep: number;
  bodies: FarkleBody[];
  gamePhase: 'idle' | 'playing' | 'win' | 'lose';
  turnActive: boolean;
  farkleCount: number;
  lastMode: EnergyMode;
  pendingBombScore: number;       // score from bomb blasts, added on next bank
  bombsOnBoard: number;           // count of bomb/rainbow_bomb on board (HUD indicator)
  multiplierOrbActive: boolean;   // next commit gets ×1.5 bonus
  catalystBoostPct: number;       // cumulative wild spawn % boost this session (0–10)
  disruptions: DisruptionEvent[];
  pendingDisruption: DisruptionEvent | null;
  doublerCells: DoublerCell[];
  disruptCharges: number;
  disruptChargeProgress: number;
  timeRemaining: number | null;
  rallyRole: RallyRole | null;

  // Actions
  setGamePhase: (phase: FarkleGameState['gamePhase']) => void;
  setTurnActive: (active: boolean) => void;
  addEnergy: (delta: number) => void;
  addToChain: (id: string, face: number) => void;
  removeLastFromChain: () => void;
  clearChain: () => void;
  commitChain: () => 'ok' | 'farkle';
  bankScore: () => void;
  updateBodies: (bodies: FarkleBody[]) => void;
  resetGame: () => void;
  addDisruption: (event: DisruptionEvent) => void;
  dismissDisruption: () => void;
  spawnDoublerCell: (column: number, durationMs?: number) => void;
  consumeDoublerCell: (column: number) => void;
  tickDisruptCharge: (deltaMs: number) => void;
  spendDisruptCharge: () => boolean;
  setRallyRole: (role: RallyRole | null) => void;
  tickTimer: (deltaMs: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcMode(energy: number): EnergyMode {
  if (energy <= 0) return 'NORMAL';
  if (energy < FRENZY_THRESHOLD) return 'PRIME';
  return 'FRENZY';
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useFarkleStore = create<FarkleGameState>()(
  subscribeWithSelector((set, get) => ({
    energy: 0,
    mode: 'NORMAL',
    chain: [],
    chainFaces: [],
    chainScore: 0,
    banked: 0,
    unbanked: 0,
    multiplierStep: 0,
    bodies: [],
    gamePhase: 'idle',
    turnActive: true,
    farkleCount: 0,
    lastMode: 'NORMAL' as EnergyMode,
    pendingBombScore: 0,
    bombsOnBoard: 0,
    multiplierOrbActive: false,
    catalystBoostPct: 0,
    disruptions: [],
    pendingDisruption: null,
    doublerCells: [],
    disruptCharges: 0,
    disruptChargeProgress: 0,
    timeRemaining: null,
    rallyRole: null,

    setGamePhase: (phase) => set({ gamePhase: phase }),
    setTurnActive: (active) => set({ turnActive: active }),

    addEnergy: (delta) =>
      set(s => {
        const energy = Math.max(0, Math.min(MAX_ENERGY, s.energy + delta));
        const mode = calcMode(energy);
        return { energy, mode, lastMode: s.mode };
      }),

    addToChain: (id, face) =>
      set(s => {
        if (s.chain.includes(id)) return s;
        return {
          chain: [...s.chain, id],
          chainFaces: [...s.chainFaces, face],
        };
      }),

    removeLastFromChain: () =>
      set(s => ({
        chain: s.chain.slice(0, -1),
        chainFaces: s.chainFaces.slice(0, -1),
      })),

    clearChain: () => set({ chain: [], chainFaces: [], chainScore: 0 }),

    commitChain: () => {
      const s = get();
      if (s.chain.length === 0) return 'ok';

      const rawScore = s.chainScore;
      const chainLen = s.chain.length;

      if (rawScore === 0) {
        // Farkle: lose unbanked, reset multiplier
        set({
          chain: [], chainFaces: [], chainScore: 0,
          unbanked: 0, multiplierStep: 0,
          farkleCount: s.farkleCount + 1,
        });
        return 'farkle';
      }

      const mult = MULTIPLIER_LADDER[Math.min(s.multiplierStep, 5)] ?? 1;
      const scaled = Math.round(rawScore * mult);

      // FF V3 rule: chain-6 advances multiplier; all others RESET to 0
      const newMultStep = chainLen === MAX_CHAIN
        ? Math.min(s.multiplierStep + 1, 5)
        : 0;

      // FF V3 scoring: chain < 6 auto-banks (unbanked → banked); chain = 6 stays unbanked
      let newBanked = s.banked;
      let newUnbanked = s.unbanked;
      if (chainLen === MAX_CHAIN) {
        newUnbanked = s.unbanked + scaled;
      } else {
        newBanked = s.banked + s.unbanked + scaled;
        newUnbanked = 0;
      }

      // FF V3 energy rules
      let energyDelta = 0;
      if (s.mode === 'PRIME') {
        energyDelta = chainLen === MAX_CHAIN ? CHAIN6_ENERGY_GAIN : PRIME_CHAIN_ENERGY_COST;
      } else if (s.mode === 'FRENZY') {
        energyDelta = FRENZY_CHAIN_ENERGY_GAIN + (s.energy < 75 ? FRENZY_CATCHUP_BONUS : 0);
      }
      const energy = Math.max(0, Math.min(MAX_ENERGY, s.energy + energyDelta));

      set({
        chain: [], chainFaces: [], chainScore: 0,
        banked: newBanked, unbanked: newUnbanked,
        multiplierStep: newMultStep,
        energy, mode: calcMode(energy),
      });
      return 'ok';
    },

    bankScore: () =>
      set(s => ({
        banked: s.banked + s.unbanked,
        unbanked: 0,
        multiplierStep: 0,
      })),

    updateBodies: (bodies) => set({
      bodies,
      bombsOnBoard: bodies.filter(b => b.entityType === 'bomb' || b.entityType === 'rainbow_bomb').length,
    }),

    resetGame: () =>
      set({
        energy: 0, mode: 'NORMAL', lastMode: 'NORMAL',
        chain: [], chainFaces: [], chainScore: 0,
        banked: 0, unbanked: 0, multiplierStep: 0,
        bodies: [], gamePhase: 'idle', turnActive: true,
        farkleCount: 0, pendingBombScore: 0, bombsOnBoard: 0,
        multiplierOrbActive: false, catalystBoostPct: 0,
        disruptions: [], pendingDisruption: null, doublerCells: [],
        disruptCharges: 0, disruptChargeProgress: 0,
        timeRemaining: null, rallyRole: null,
      }),

    addDisruption: (event) =>
      set(s => ({
        disruptions: [...s.disruptions, event],
        pendingDisruption: s.pendingDisruption ?? event,
      })),

    dismissDisruption: () =>
      set(s => {
        const remaining = s.disruptions.filter(d => d.id !== s.pendingDisruption?.id);
        return { disruptions: remaining, pendingDisruption: remaining[0] ?? null };
      }),

    spawnDoublerCell: (column, durationMs = 30_000) =>
      set(s => {
        const filtered = s.doublerCells.filter(d => d.column !== column);
        return { doublerCells: [...filtered, { column, active: true, expiresAt: Date.now() + durationMs }] };
      }),

    consumeDoublerCell: (column) =>
      set(s => ({
        doublerCells: s.doublerCells.filter(d => d.column !== column),
      })),

    tickDisruptCharge: (deltaMs) =>
      set(s => {
        if (s.mode !== 'FRENZY' || s.gamePhase !== 'playing') return s;
        // HEADHUNTER charges 2× faster (40/s → 2.5s per charge vs 5s)
        const rate = s.rallyRole === 'HEADHUNTER' ? 40 : 20;
        let progress = s.disruptChargeProgress + (deltaMs / 1000) * rate;
        let charges = s.disruptCharges;
        while (progress >= 100 && charges < 3) {
          progress -= 100;
          charges += 1;
        }
        if (charges >= 3) progress = Math.min(progress, 99);
        return { disruptChargeProgress: progress, disruptCharges: charges };
      }),

    spendDisruptCharge: () => {
      const charges = get().disruptCharges;
      if (charges <= 0) return false;
      set({ disruptCharges: charges - 1 });
      return true;
    },

    setRallyRole: (role) => set({ rallyRole: role }),

    tickTimer: (deltaMs) =>
      set(s => {
        if (s.timeRemaining === null || s.gamePhase !== 'playing') return s;
        const timeRemaining = Math.max(0, s.timeRemaining - deltaMs / 1000);
        if (timeRemaining === 0) return { timeRemaining: 0, gamePhase: 'lose' as const };
        return { timeRemaining };
      }),
  }))
);
