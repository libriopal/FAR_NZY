// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import type { BioVariant } from './tokens.js';
import { VARIANTS } from './tokens.js';

const STORAGE_KEY = 'match3d_variant';
const DEFAULT_VARIANT: BioVariant = 'blueprint';

// Safe localStorage wrapper — blocked in some Android WebViews with strict
// security policies (e.g. third-party cookie restrictions, private browsing).
function storageGet(key: string): string | null {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function storageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); }
  catch { /* silently ignore — variant falls back to default each session */ }
}

export function setVariant(variant: BioVariant): void {
  document.body.setAttribute('data-variant', variant);
  storageSet(STORAGE_KEY, variant);
}

export function getVariant(): BioVariant {
  const stored = storageGet(STORAGE_KEY) as BioVariant | null;
  if (stored && VARIANTS.includes(stored)) return stored;
  return DEFAULT_VARIANT;
}

export function initVariant(): void {
  try {
    setVariant(getVariant());
  } catch {
    // Last-resort: at minimum stamp the body attribute so CSS vars work
    document.body.setAttribute('data-variant', DEFAULT_VARIANT);
  }
}
