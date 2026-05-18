// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Physical tray burn-buffer store.
// ─────────────────────────────────────────────────────

import { create } from 'zustand';

export interface TraySlot {
  id: string;
  entityType: 'die' | 'sphere' | 'wild' | 'bomb' | 'rainbow_bomb' | string;
  face: number | null;
  burnStartAt: number | null;
  state: 'falling' | 'burning' | 'done';
  burnDurationMs: number; // 2000-4000
}

export const TRAY_MAX_SLOTS = 6;
export const TRAY_BURN_MIN_MS = 2000;
export const TRAY_BURN_MAX_MS = 4000;

interface TrayState {
  slots: TraySlot[];
  addToTray: (entityType: string, face: number | null, burnMs?: number) => string | null;
  beginBurn: (id: string) => void;
  clearSlot: (id: string) => void;
  getEmptySlotCount: () => number;
  getOccupiedCount: () => number;
  reset: () => void;
}

export const useTrayStore = create<TrayState>((set, get) => ({
  slots: [],

  addToTray: (entityType, face, burnMs) => {
    const current = get().slots.filter(s => s.state !== 'done');
    if (current.length >= TRAY_MAX_SLOTS) return null;
    const id = crypto.randomUUID();
    const _r = crypto.getRandomValues(new Uint32Array(1))[0]! / 0xFFFFFFFF;
    const burnDurationMs = burnMs ?? (TRAY_BURN_MIN_MS + Math.floor(_r * (TRAY_BURN_MAX_MS - TRAY_BURN_MIN_MS)));
    set(s => ({
      slots: [...s.slots, { id, entityType, face, burnStartAt: null, state: 'falling', burnDurationMs }],
    }));
    return id;
  },

  beginBurn: (id) => set(s => ({
    slots: s.slots.map(slot =>
      slot.id === id ? { ...slot, state: 'burning', burnStartAt: Date.now() } : slot,
    ),
  })),

  clearSlot: (id) => set(s => ({
    slots: s.slots.filter(slot => slot.id !== id),
  })),

  getEmptySlotCount: () => {
    const occupied = get().slots.filter(s => s.state !== 'done').length;
    return Math.max(0, TRAY_MAX_SLOTS - occupied);
  },

  getOccupiedCount: () => get().slots.filter(s => s.state !== 'done').length,

  reset: () => set({ slots: [] }),
}));
