// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import type { BioVariant } from './tokens.js';
import { VARIANTS } from './tokens.js';

const STORAGE_KEY = 'match3d_variant';
const DEFAULT_VARIANT: BioVariant = 'blueprint';

export function setVariant(variant: BioVariant): void {
  document.body.setAttribute('data-variant', variant);
  localStorage.setItem(STORAGE_KEY, variant);
}

export function getVariant(): BioVariant {
  const stored = localStorage.getItem(STORAGE_KEY) as BioVariant | null;
  if (stored && VARIANTS.includes(stored)) return stored;
  return DEFAULT_VARIANT;
}

export function initVariant(): void {
  setVariant(getVariant());
}
