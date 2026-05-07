# PATCH F3 — GameScreen.tsx + Grid.tsx Bio-Architect Layout
## Target: apps/client/src/components/GameScreen.tsx
##          apps/client/src/components/Grid.tsx
## Operation: replace_file (both)

---

### CONTEXT

Both files exist and compile. This patch applies Bio-Architect zone styling.
ALL game logic, hook wiring, and useChain pointer delegation must be
preserved exactly. Only the visual shell changes.

Import bio-architect.css in both files:
```typescript
import '../styles/bio-architect.css';
```

---

### GAMESCREEN.TSX SPEC

**Zone layout — 100dvh, no scroll (STRICT)**

```
┌─────────────────────────────────────┐  44px  TopBar
├─────────────────────────────────────┤  48px  EnergyBar
├─────────────────────────────────────┤  36px  InfoStrip
│                                     │
│              GRID                   │  flex-1
│                                     │
├─────────────────────────────────────┤  68px  BankBar
└─────────────────────────────────────┘
HeistGameScreen adds VaultBar (56px) below BankBar.
```

**TopBar (44px)**
```
Background:  var(--ba-glass-bg-heavy) + backdrop-filter: var(--ba-glass-blur)
Border-bottom: 1px solid var(--ba-glass-border)
Content:     [Mode label] [Round # if multiplayer] [Phase badge] [⚙ button]
⚙ button:   U+2699 Unicode, NOT emoji, NOT image
             Opens SettingsModal (already wired from D4 — call existing handler)
Mode label:  text in var(--ba-marble-200), font-mono
Phase badge: glass pill with var(--ba-accent) text (reads body[data-variant])
```

**EnergyBar (48px)**
```
Background:  var(--ba-marble-900)
Border-bottom: 1px solid var(--ba-glass-border)
Fill bar:    gradient left-to-right: var(--ba-vine-dark) → var(--ba-glow-green)
             Width: (energy / MAX_ENERGY * 100)%
             Transition: width 100ms linear
             Animation: ba-vine-grow when energy increases rapidly
Frenzy state (energy > 150):
             Fill gradient switches to: var(--ba-vine-mid) → var(--ba-glow-teal)
             Pulsing glow on fill bar edge
Labels:      Energy value right-aligned, font-mono, var(--ba-marble-200)
             "FRENZY" label appears in var(--ba-glow-teal) when active
```

**InfoStrip (36px)**
```
Background:  var(--ba-glass-bg) + backdrop-filter: var(--ba-glass-blur)
Border-bottom: 1px solid var(--ba-glass-border)
Left:        [×M] current multiplier — font-black, var(--ba-glow-amber)
Center:      6-dot ladder (existing MultiplierLadder component — keep wired)
Right:       Last combo label — font-mono, var(--ba-marble-200)
```

**Grid zone (flex-1)**
```
Background:  var(--ba-surface-bg) — reads CSS var, changes per variant
Grid frame border: 1px solid var(--ba-glass-border)
Variant class on grid wrapper div:
  [data-variant="architect"] → .ba-grid-glass   (glass panel border)
  [data-variant="gardener"]  → .ba-grid-vine    (vine SVG border decoration)
  [data-variant="blueprint"] → .ba-grid-blueprint (blueprint grid lines frame)
Frenzy active: add class 'ba-frenzy-active' → border pulses via ba-frenzy-pulse
```

**BankBar (68px)**
```
Background:  var(--ba-glass-bg-heavy) + backdrop-filter: var(--ba-glass-blur)
Border-top:  1px solid var(--ba-glass-border)
Layout:      3 columns equal width

Left cell — BANKED:
  Label:  "BANKED" — font-mono, 10px, var(--ba-marble-500)
  Value:  font-black, 18px, var(--ba-safe) — green
  Pulse:  brief scale-up animation on value change

Center cell — AT RISK:
  Label:  "AT RISK" — font-mono, 10px, var(--ba-marble-500)
  Value:  font-black, 18px, var(--ba-glow-amber) — amber
  Pulse:  slow opacity pulse (0.8→1.0) while unbanked > 0

Right cell — BANK button:
  Background:  var(--ba-glass-bg-heavy)
  Border:      1px solid var(--ba-glow-amber) when unbanked > 0
               1px solid var(--ba-glass-border) when unbanked === 0
  Text:        "BANK" — font-black, var(--ba-glow-amber)
  Hover:       background var(--ba-glow-amber) at 15% opacity
  Disabled:    opacity 0.4 when unbanked === 0
  On click:    calls existing bank() from useGame — do not change
```

---

### GRID.TSX SPEC

Grid.tsx has critical pointer event delegation for useChain.
PRESERVE THIS EXACTLY — do not change pointer event handlers.

**What changes in Grid.tsx:**
1. Add className on the outer grid wrapper div:
   `ba-grid-${variant}` where variant = getVariant() from variants.ts
2. Add class `ba-frenzy-active` when isFrenzy/energyMode === 'FRENZY'
3. No other logic changes

**Import to add:**
```typescript
import { getVariant } from '../styles/variants';
import '../styles/bio-architect.css';
```

**Cell sizing — preserve exactly:**
```
cellSize = Math.floor((Math.min(containerW, containerH) - padding) / gridDim)
Clamped: Math.max(28, Math.min(72, cellSize))
Gap: 2px between cells
ResizeObserver logic: unchanged
```

---

### VARIANT CSS CLASSES (add to bio-architect.css in F1 or inline here)

```css
.ba-grid-glass {
  border: 1px solid var(--ba-glass-border);
  border-radius: 4px;
}
.ba-grid-vine {
  border: 2px solid var(--ba-vine-mid);
  border-radius: 8px;
  box-shadow: 0 0 12px rgba(21, 128, 61, 0.2);
}
.ba-grid-blueprint {
  border: 1px solid var(--ba-blueprint);
  border-radius: 2px;
  box-shadow: 0 0 8px var(--ba-blueprint-glow);
}
.ba-frenzy-active {
  animation: ba-frenzy-pulse 600ms ease-in-out infinite;
}
```

---

### DO NOT

- Do not change useGame, useChain, useEnergy hook wiring
- Do not change pointer event handlers in Grid.tsx
- Do not change cell sizing / ResizeObserver logic
- Do not remove existing game logic (bank, farkle handling, etc.)
- Do not use setInterval for energy — it's already RAF in useEnergy
- Do not use framer-motion — motion/react only
- Do not remove activeBombs prop handling if it exists (even if empty)
- Do not hardcode hex values — CSS vars only

---

### HARD CONSTRAINTS

- TypeScript strict, no any
- Import aliases: @farkle/shared/types, @farkle/engine/*
- bio-architect.css imported in both files
- getVariant() from ../styles/variants (F1 must be complete first)
- 100dvh layout — no scroll under any circumstance
- ⚙ must be U+2699 (Unicode char, not emoji)
