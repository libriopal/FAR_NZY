# PATCH F4 — AuthScreen.tsx + useUserProfile.ts Bio-Architect Skin
## Target: apps/client/src/screens/AuthScreen.tsx
##          apps/client/src/hooks/useUserProfile.ts
## Operation: replace_file (both — files exist from D-block)

---

### CONTEXT

Both files exist and compile from D-block. This patch applies Bio-Architect
glass card styling to the auth UI. All hook logic and auth state must be
preserved exactly. Only the visual presentation changes.

---

### useUserProfile.ts — PRESERVE ALL LOGIC

Do not change any logic in this file. The only permitted change is ensuring
the UserProfile interface includes the `color` field typed as UsernameColor:

```typescript
type UsernameColor = 'red'|'orange'|'yellow'|'green'|'blue'|'purple';
```

Map UsernameColor to hex for rendering in AuthScreen:
```typescript
export const USERNAME_COLOR_HEX: Record<UsernameColor, string> = {
  red:    '#f43f5e',
  orange: '#f97316',
  yellow: '#fbbf24',
  green:  '#4ade80',
  blue:   '#0ea5e9',
  purple: '#7c3aed',
};
```

Add this export if not already present. Do not change anything else.

---

### AuthScreen.tsx — VISUAL SPEC

**Page background:**
```
Full screen: var(--ba-surface-bg) — variant-aware
Background texture: subtle marble grain via CSS noise (optional)
```

**Auth card (center of page):**
```
Background:    var(--ba-glass-bg-heavy) + backdrop-filter: var(--ba-glass-blur-heavy)
Border:        1px solid var(--ba-glass-border)
Border-radius: 12px
Padding:       24px
Max-width:     360px
Left edge:     3px solid var(--ba-accent) — variant accent color
```

**Tab row (CREATE / LOGIN / GUEST):**
```
Glass pills: selected = var(--ba-accent) text + glow-border
             unselected = var(--ba-marble-500) text
```

**Form inputs:**
```
Background:  rgba(255, 255, 255, 0.04)
Border:      1px solid var(--ba-glass-border)
Focus:       border-color var(--ba-accent)
Text:        var(--ba-marble-200)
Placeholder: var(--ba-marble-500)
Font:        monospace
```

**ASCII art preview:**
```
Container:   48px × 48px, border: 1px solid var(--ba-glass-border)
Font:        font-mono, text-[7px], leading-none
Color:       USERNAME_COLOR_HEX[profile.color]
Overflow:    hidden, first 3 lines only
```

**Color picker:**
```
6 circle swatches using USERNAME_COLOR_HEX values
Active:      ring-2 ring-white ring-offset-1 ring-offset-transparent
```

**Submit button:**
```
Background:  var(--ba-accent) at 20% opacity
Border:      1px solid var(--ba-accent)
Text:        var(--ba-accent), font-black
Hover:       background 30% opacity
```

**PLAY AS GUEST link:**
```
Text: var(--ba-marble-500), underline
Below the form card
```

---

### DO NOT

- Do not change authentication logic (login, register, SHA-256 password)
- Do not change localStorage keys
- Do not change UserProfile interface fields
- Do not hardcode hex — use CSS vars where possible, USERNAME_COLOR_HEX for dynamic colors
- Do not use Math.random()

---

---

# PATCH F5 — SettingsModal.tsx + AccountTab.tsx Bio-Architect + Variant Switcher
## Target: apps/client/src/components/SettingsModal.tsx
##          apps/client/src/components/AccountTab.tsx
## Operation: replace_file (both — files exist from D-block)

---

### CONTEXT

Both files exist from D-block. This patch adds the variant switcher to the
THEME tab and applies Bio-Architect glass modal styling. All existing tab
content (AUDIO, SANDBOX) must be preserved.

---

### SettingsModal.tsx VISUAL SPEC

**Modal backdrop:**
```
Fixed overlay: background rgba(28, 25, 23, 0.80)  (--ba-marble-950 at 80%)
Backdrop-filter: blur(4px)
```

**Modal panel:**
```
Background:    var(--ba-glass-bg-heavy) + backdrop-filter: var(--ba-glass-blur-heavy)
Border:        1px solid var(--ba-glass-border)
Border-radius: 16px
Max-width:     480px, max-height: 80dvh
Top accent:    3px solid var(--ba-accent) at top border-radius
```

**Tab bar:**
```
Tabs: THEME | AUDIO | SANDBOX | ACCOUNT
Active tab:   border-bottom: 2px solid var(--ba-accent), text var(--ba-marble-200)
Inactive tab: text var(--ba-marble-500)
Font: font-mono, uppercase, letter-spacing
```

**Close button (×):**
```
Position: top-right of modal header
Style:    glass circle, var(--ba-marble-500) text
Hover:    var(--ba-danger) text
ACCOUNT tab must be positioned to the LEFT of this button (existing D4 rule)
```

**THEME tab — ADD variant switcher (new content):**

```
Section header: "LAYOUT VARIANT" — font-mono, var(--ba-marble-500), 10px uppercase

3 variant cards side by side:
  Each card (width: ~140px):
    Background:    var(--ba-glass-bg)
    Border:        1px solid var(--ba-glass-border) (inactive)
                   2px solid var(--ba-glow-green) (active)
    Border-radius: 8px
    Padding:       12px

    Preview thumbnail (60px × 40px):
      [v1 Architect]:  Shows glass panel with amber accent stripe
      [v2 Gardener]:   Shows vine-green border on dark forest bg
      [v3 Blueprint]:  Shows blueprint-blue border on dark navy bg
      Render as div with inline styles — no images needed

    Label:    "ARCHITECT" | "GARDENER" | "BLUEPRINT"
              font-mono, 10px, var(--ba-marble-200)

    On click: call setVariant(variant) from ../styles/variants
              Update active card border immediately

Active variant: read from getVariant() on mount
```

Below variant switcher — existing dark/light toggle preserved.

**AUDIO, SANDBOX tabs:** preserve exactly from D-block. Do not change.

---

### AccountTab.tsx VISUAL SPEC

**Profile display:**
```
Username:     font-black, var(--ba-marble-200), font-mono
Color swatch: 16px circle, USERNAME_COLOR_HEX[profile.color]
ASCII art:    <pre> tag, font-mono text-[7px], color USERNAME_COLOR_HEX[color]
              Max 8 lines × 12 chars
Blueprint divider: 1px solid var(--ba-blueprint) at 20% opacity between sections
```

**Edit fields:** same glass input style as AuthScreen

**Logout button:**
```
Background:  rgba(239, 68, 68, 0.10)
Border:      1px solid var(--ba-danger)
Text:        var(--ba-danger)
```

---

### DO NOT

- Do not change AUDIO tab logic or controls
- Do not change SANDBOX tab
- Do not change auth-related functions in AccountTab
- Do not move ACCOUNT tab position relative to × button
- Do not use framer-motion

---

---

# PATCH F6 — Lobby.tsx + LobbySettings.tsx + HostLobbyPanel.tsx Bio-Architect
## Target: apps/client/src/components/Lobby.tsx
##          apps/client/src/components/LobbySettings.tsx
##          apps/client/src/components/HostLobbyPanel.tsx
## Operation: replace_file (all three — files exist from D-block)

---

### CONTEXT

All three files exist from D-block. Preserve all routing logic, mode
selection, and player count wiring. Apply Bio-Architect glass card styling.

---

### Lobby.tsx VISUAL SPEC

**Page background:** var(--ba-surface-bg) full screen

**Wallet header strip (top):**
```
Glass panel: --ba-glass-bg + blur
FD badge:    bg-violet-900/50 border border-violet-500 text-sky-300
PDX badge:   bg-emerald-950/50 border border-emerald-500 text-amber-400
Currency toggle pill: same badge colors, slide animation
```

**Mode cards (4 cards: SOLO | VERSUS | RALLY | HEIST):**
```
Background:    var(--ba-glass-bg)
Border:        1px solid var(--ba-glass-border)
Border-radius: 12px
Left accent:   4px solid [mode accent color]
  SOLO:   var(--ba-glow-amber)
  VERSUS: var(--ba-blueprint)
  RALLY:  var(--ba-glow-green)
  HEIST:  var(--ba-danger)

Active/selected card:
  Border:     2px solid [mode accent color]
  Background: var(--ba-glass-bg-heavy)
  Box-shadow: 0 0 16px [accent at 25%]

Card content:
  Mode emoji + name: font-black, var(--ba-marble-200)
  Description: 1 line, var(--ba-marble-500), font-mono
  Player count badge: glass pill
```

**Stake input (casino modes):**
```
Same glass input style as AuthScreen
Label: var(--ba-glow-amber), font-mono
PDX indicator glow on focus
```

**CTA buttons:**
```
Primary (PLAY NOW / FIND PLAYERS):
  Background:  var(--ba-accent) at 20%
  Border:      1px solid var(--ba-accent)
  Text:        var(--ba-accent), font-black
  Full width
```

**Settings ⚙ button:**
```
U+2699 Unicode, bottom of lobby, glass circle
Opens SettingsModal — use existing handler from D-block
```

---

### LobbySettings.tsx VISUAL SPEC

Player count buttons: glass toggle pills, active = var(--ba-accent) border
Username whitelist tags: glass chips with × remove, var(--ba-marble-200) text
Section dividers: 1px var(--ba-glass-border) lines

Preserve: all state wiring, all setting callbacks — visual only.

---

### HostLobbyPanel.tsx VISUAL SPEC

**Player slot cards:**
```
Filled slot:
  Background:  var(--ba-glass-bg)
  Border:      1px solid var(--ba-glass-border)
  ASCII art:   first 3 lines, USERNAME_COLOR_HEX color, 48×48 container
  Username:    font-mono, var(--ba-marble-200)
Empty slot:
  Background:  transparent
  Border:      1px dashed var(--ba-glass-border) — blueprint outline
  Content:     "WAITING..." font-mono var(--ba-marble-500)
```

**Countdown:**
```
Blueprint circle ring draining clockwise over 30 seconds
Center text: remaining seconds, font-black, var(--ba-blueprint)
```

**[START NOW] button:**
```
Border: 1px solid var(--ba-glow-green)
Text:   var(--ba-glow-green), font-black
```

**[CANCEL] button:**
```
Border: 1px solid var(--ba-danger)
Text:   var(--ba-danger)
```

---

### DO NOT

- Do not change mode selection logic
- Do not change player count wiring
- Do not change FD/PDX currency derivation (FD→FREE, PDX→CASINO)
- Do not change countdown timer logic
- Do not remove chat panel stub if present

---

---

# PATCH F7 — HeistGameScreen.tsx + App.tsx Bio-Architect Final
## Target: apps/client/src/components/HeistGameScreen.tsx
##          apps/client/src/App.tsx
## Operation: replace_file (both — files exist from D-block)

---

### CONTEXT

Both files exist from D-block. HeistGameScreen gets a Bio-Architect VaultBar.
App.tsx gets minimal updates: import initVariant on mount, blueprint page
transitions, ensure SettingsModal is mounted at app level.

---

### HeistGameScreen.tsx VISUAL SPEC

HeistGameScreen uses same zone layout as GameScreen (TopBar + EnergyBar +
InfoStrip + Grid + BankBar) PLUS one additional zone at bottom:

**VaultBar (56px — HEIST ONLY):**
```
Background:    var(--ba-marble-900)
Border-top:    1px solid var(--ba-glass-border)
Layout:        Left: VAULT label + value | Center: fill bar | Right: HEIST button

VAULT label:   "VAULT" font-mono 10px var(--ba-marble-500)
VAULT value:   font-black 16px var(--ba-glow-amber)

Fill bar:
  Track:       var(--ba-marble-800) rounded
  Fill:        gradient var(--ba-vine-mid) → var(--ba-glow-amber)
  Width:       (vaultValue / VAULT_THRESHOLD * 100)% clamped 0–100
  Transition:  width 300ms ease
  Glow pulse when fill reaches 100%: box-shadow 0 0 12px var(--ba-glow-amber)

HEIST button (appears when vault >= VAULT_THRESHOLD AND energy >= HEIST_ENERGY_COST):
  Background:  rgba(239, 68, 68, 0.12)
  Border:      1px solid var(--ba-danger)
  Text:        var(--ba-danger) "HEIST" font-black
  Hover:       background 25% opacity, glow
  Disabled:    opacity 0.3 pointer-events-none (when threshold not met)

Heist window active (5-second countdown):
  VaultBar background: pulses var(--ba-danger) at 15% opacity
  HEIST button becomes CANCEL (for initiator) or BLOCK (for others)
  Countdown ring on button (SVG, same pattern as bomb ring)

Role indicators (icon row, far right of VaultBar):
  ARCHIVIST:   🛡 shield icon — tooltip "20% vault shield"
  CONDUCTOR:   🎼 note icon — tooltip "+10% contribution"
  RAINMAKER:   ⏱ timer icon — tooltip "Heist window +2s"
  HEADHUNTER:  🎯 target icon — tooltip "Block = 15% recovery"
  Display: small icons in var(--ba-marble-500), only show active role
```

---

### App.tsx CHANGES (MINIMAL)

1. Add on mount: `import { initVariant } from './styles/variants'; initVariant();`
   Call in root component useEffect with empty deps — sets body[data-variant]
   from localStorage on app load.

2. Page transition between screens:
   Add CSS class `ba-screen-enter` on route change:
   ```css
   @keyframes ba-screen-enter {
     from { opacity: 0; clip-path: inset(0 100% 0 0); }
     to   { opacity: 1; clip-path: inset(0 0% 0 0); }
   }
   .ba-screen-enter { animation: ba-screen-enter 250ms ease-out; }
   ```
   Apply to the screen wrapper div on route change via key prop.

3. Confirm SettingsModal is mounted at App level (global, not per-screen).
   If it is already from D-block — do not move it.

4. Preserve ALL existing routing logic exactly.
   SOLO_* → GameScreen
   VS_* → VSGameScreen (stub)
   RALLY_* → RallyGameScreen (stub)
   HEIST_* → HeistGameScreen

---

### DO NOT

- Do not change game logic in HeistGameScreen
- Do not change VAULT_SPLIT, VAULT_THRESHOLD, HEIST_ENERGY_COST constants
- Do not change App.tsx routing
- Do not change screen state machine
- Do not add React.StrictMode
- Do not use framer-motion — motion/react only
- Do not hardcode hex values
