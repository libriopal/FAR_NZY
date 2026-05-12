// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// KYC verification state store.
// ─────────────────────────────────────────────────────

import { create } from 'zustand';

export type KYCStatus = 'unverified' | 'pending' | 'verified';

interface KYCState {
  status: KYCStatus;
  modalOpen: boolean;
  setStatus: (s: KYCStatus) => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useKYCStore = create<KYCState>((set) => ({
  status: 'unverified',
  modalOpen: false,
  setStatus: (s) => set({ status: s }),
  openModal: () => set({ modalOpen: true }),
  closeModal: () => set({ modalOpen: false }),
}));
