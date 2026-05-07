# PATCH F1 — Bio-Architect Design Token System
## Target: apps/client/src/styles/bio-architect.css
##          apps/client/src/styles/tokens.ts
##          apps/client/src/styles/variants.ts
## Operation: create_file (all three are NEW)

---

### CONTEXT

The project compiles clean with all A–E patches complete. This patch creates
the Bio-Architect design system foundation. All subsequent F patches import
from these files. Do NOT touch any existing file — only create the three
listed above.

---

### FILE 1: apps/client/src/styles/bio-architect.css

Pure CSS custom properties. No Tailwind. No JS. No imports. Declare on :root.

```css
:root {
  /* Glass surfaces */
  --ba-glass-bg:          rgba(255, 255, 255, 0.06);
  --ba-glass-bg-heavy:    rgba(255, 255, 255, 0.11);
  --ba-glass-border:      rgba(255, 255, 255, 0.14);
  --ba-glass-blur:        blur(14px) saturate(180%);
  --ba-glass-blur-heavy:  blur(20px) saturate(200%);

  /* Marble base */
  --ba-marble-950:  #1c1917;
  --ba-marble-900:  #292524;
  --ba-marble-800:  #44403c;
  --ba-marble-500:  #78716c;
  --ba-marble-200:  #e7e5e4;

  /* Bioluminescent flora */
  --ba-glow-green:  #4ade80;
  --ba-glow-teal:   #22d3ee;
  --ba-glow-amber:  #f59e0b;
  --ba-vine-dark:   #15803d;
  --ba-vine-mid:    #16a34a;

  /* Blueprint / wireframe */
  --ba-blueprint:      #3b82f6;
  --ba-blueprint-glow: rgba(59, 130, 246, 0.35);

  /* Metal */
  --ba-metal-gradient: linear-gradient(135deg, #374151, #4b5563, #374151);
  --ba-metal-border:   #6b7280;

  /* Functional */
  --ba-danger:  #ef4444;
  --ba-safe:    #22c55e;

  /* Timing */
  --ba-dissolve-ms:   400ms;
  --ba-vine-grow-ms:  800ms;
  --ba-frenzy-ms:     200ms;
}

/* Variant overrides */
[data-variant="architect"] {
  --ba-surface-bg:  var(--ba-marble-950);
  --ba-card-bg:     var(--ba-glass-bg);
  --ba-card-border: var(--ba-glass-border);
  --ba-accent:      var(--ba-glow-amber);
}

[data-variant="gardener"] {
  --ba-surface-bg:  #0f1f0f;
  --ba-card-bg:     rgba(21, 128, 61, 0.08);
  --ba-card-border: rgba(74, 222, 128, 0.20);
  --ba-accent:      var(--ba-glow-green);
}

[data-variant="blueprint"] {
  --ba-surface-bg:  #0d1117;
  --ba-card-bg:     rgba(59, 130, 246, 0.06);
  --ba-card-border: rgba(59, 130, 246, 0.20);
  --ba-accent:      var(--ba-blueprint);
}

/* Blueprint dissolve keyframe — used by Tile.tsx on commit */
@keyframes ba-dissolve {
  0%   { opacity: 1; transform: scale(1);    outline: 0px solid transparent; }
  40%  { opacity: 0.4; transform: scale(0.9); outline: 2px solid var(--ba-blueprint); }
  100% { opacity: 0; transform: scale(0);    outline: 0px solid transparent; }
}

/* Vine grow keyframe — used by EnergyBar */
@keyframes ba-vine-grow {
  from { background-size: 0% 100%; }
  to   { background-size: 100% 100%; }
}

/* Blueprint pulse — used by bombs */
@keyframes ba-blueprint-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--ba-blueprint-glow); }
  50%       { box-shadow: 0 0 0 8px transparent; }
}

/* Frenzy border pulse */
@keyframes ba-frenzy-pulse {
  0%, 100% { border-color: var(--ba-glow-teal); }
  50%       { border-color: transparent; }
}
```

---

### FILE 2: apps/client/src/styles/tokens.ts

TypeScript mirror of the CSS custom properties for use in JS/inline styles.

```typescript
export const BIO_TOKENS = {
  glass: {
    bg:          'rgba(255, 255, 255, 0.06)',
    bgHeavy:     'rgba(255, 255, 255, 0.11)',
    border:      'rgba(255, 255, 255, 0.14)',
  },
  marble: {
    950: '#1c1917',
    900: '#292524',
    800: '#44403c',
    500: '#78716c',
    200: '#e7e5e4',
  },
  glow: {
    green:  '#4ade80',
    teal:   '#22d3ee',
    amber:  '#f59e0b',
  },
  vine: {
    dark: '#15803d',
    mid:  '#16a34a',
  },
  blueprint: '#3b82f6',
  danger:    '#ef4444',
  safe:      '#22c55e',
} as const;

export type BioVariant = 'architect' | 'gardener' | 'blueprint';
export const VARIANTS: BioVariant[] = ['architect', 'gardener', 'blueprint'];
```

---

### FILE 3: apps/client/src/styles/variants.ts

Variant switching logic. Reads/writes `body[data-variant]`.

```typescript
import { BioVariant, VARIANTS } from './tokens';

const STORAGE_KEY = 'farkle_variant';
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
```

---

### DO NOT

- Do not import anything from @farkle/engine or @farkle/shared
- Do not use Math.random()
- Do not create any React components
- Do not touch any existing file — create only
- Do not use Tailwind in the CSS file
- Do not add game logic of any kind

---

### REQUIRED EXPORTS

tokens.ts:     BIO_TOKENS, BioVariant, VARIANTS
variants.ts:   setVariant, getVariant, initVariant
