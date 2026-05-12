// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual-only: tracks active bomb detonation events and pre-destroy highlights.
// No game logic here. No scoring. No balance.
// ─────────────────────────────────────────────────────

import { create } from 'zustand';

export interface ExplosionEvent {
  id: string;
  x: number;
  y: number;
  z: number;
  type: 'bomb' | 'rainbow_bomb';
  startTime: number; // performance.now() at detonation
}

interface ExplosionStore {
  explosions: ExplosionEvent[];
  highlightedBodyIds: string[];  // brief pre-destroy glow targets
  addExplosion: (e: Omit<ExplosionEvent, 'id' | 'startTime'>) => void;
  removeExplosion: (id: string) => void;
  setHighlightedIds: (ids: string[]) => void;
}

export const useExplosionStore = create<ExplosionStore>((set) => ({
  explosions: [],
  highlightedBodyIds: [],
  addExplosion: (e) => set(s => ({
    explosions: [...s.explosions, { ...e, id: crypto.randomUUID(), startTime: performance.now() }],
  })),
  removeExplosion: (id) => set(s => ({
    explosions: s.explosions.filter(ev => ev.id !== id),
  })),
  setHighlightedIds: (ids) => set({ highlightedBodyIds: ids }),
}));
