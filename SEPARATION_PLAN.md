# FARKLE FRENZY V3 — CORE / SURFACE SEPARATION PLAN
# Generated: 2026-05-07

---

## PART 1 — CORE SACRED FILE LIST

| File | Why Sacred |
|------|-----------|
| `packages/farkle-shared/src/types.ts` | Canonical game types: Cell, GameState, LobbySettings, GAME_CONSTANTS, MULTIPLIER_LADDER, ENERGY_CONSTANTS — changes cascade everywhere |
| `packages/farkle-shared/src/index.ts` | Re-exports all shared types; entry point for every consumer |
| `packages/farkle-engine/src/chainIndex.ts` | Scoring lookup table builder, encode/decode, internalScoreFarkle — heart of scoring |
| `packages/farkle-engine/src/farkleScorer.ts` | Public scoreFarkle() API, FarkleResult interface |
| `packages/farkle-engine/src/farkleScorer.test.ts` | Only regression test suite for scoring correctness |
| `packages/farkle-engine/src/csprng.ts` | HMAC-SHA256 CSPRNG, provably fair protocol — mathematical casino foundation |
| `packages/farkle-engine/src/gridUtils.ts` | SixPoolManager, createGrid, stepGravity, spawnTiles, applyStandardBomb, applyRainbowBomb, damageAdjacentBlockers, hasValidChain — entire grid state machine |
| `packages/farkle-engine/src/floodFill.ts` | BFS utility for dead board detection |
| `packages/farkle-engine/src/monteCarlo.ts` | RTP normalizer calibration — casino math |
| `packages/farkle-engine/src/rtpConfig.ts` | RTP targets per mode, house edge, pool sizes |
| `packages/farkle-engine/src/index.ts` | Engine entry point (all exports) |
| `packages/farkle-engine/src/web.ts` | Web-safe engine subset entry |
| `apps/web/src/store/farkleStore.ts` | Game state machine: scoring, multiplier, banking, energy mode, farkle detection |
| `apps/web/src/store/gameStore.ts` | Session state: activeScreen, gamePhase — CORE because gamePhase is game logic |
| `apps/web/src/hooks/useFarkleGame.ts` | Chain input logic, energy RAF tick, round flow orchestration |
| `apps/server/src/gameRoom.ts` | Server game room: scoring, grid state, turn management, role assignment, banking |

---

## PART 2 — SURFACE MODIFIABLE FILE LIST

| File | Safe to modify |
|------|---------------|
| `apps/web/src/components/GameScreen.tsx` | Visual layout, scene mounting, UI chrome |
| `apps/web/src/components/FarkleHUD.tsx` | Score display formatting, color, animation |
| `apps/web/src/components/HUD.tsx` | Legacy HUD display, styling |
| `apps/web/src/components/HomeScreen.tsx` | Lobby appearance, mode selector UI |
| `apps/web/src/components/MultiplayerLobby.tsx` | Lobby room UI, player list appearance |
| `apps/web/src/components/WinLoseScreen.tsx` | Win/lose visual presentation |
| `apps/web/src/components/EstateScreen.tsx` | Meta/estate UI display |
| `apps/web/src/components/ShopScreen.tsx` | Shop UI, item display |
| `apps/web/src/components/AgeGate.tsx` | Age verification UI flow |
| `apps/web/src/components/SocialScreen.tsx` | Social/leaderboard display |
| `apps/web/src/components/EventBanner.tsx` | Event display UI |
| `apps/web/src/components/QuestPanel.tsx` | Quest display UI |
| `apps/web/src/game/VoxelPileScene.tsx` | 3D scene rendering, tile appearance, camera |
| `apps/web/src/styles/bio-architect.css` | Design tokens, colors, animations |
| `apps/web/src/styles/tokens.ts` | Design token values |
| `apps/web/src/styles/variants.ts` | Theme switching logic |
| `apps/web/src/App.tsx` | App shell, routing, bootstrap |
| `apps/web/src/main.tsx` | Entry point |
| `apps/web/src/data/levels.ts` | Level spawn weight configs (visual tuning) |
| `apps/web/src/store/multiplayerStore.ts` | WebSocket state tracking (presentation layer) |
| `apps/web/src/hooks/useMultiplayer.ts` | Thin WS hook wrapper around multiplayerStore |
| `apps/web/src/hooks/useEconomy.ts` | Economy display/credit hook |
| `apps/web/src/hooks/useLiveEvents.ts` | Live event display hook |
| `apps/web/src/hooks/useQuests.ts` | Quest display hook |
| `apps/server/src/index.ts` | Server bootstrap, room routing |
| `apps/server/src/sandbox.ts` | RTP sandbox endpoint |

---

## PART 3 — BOUNDARY VIOLATIONS

### BV1 — useFarkleGame.ts (CORE) coupled to VoxelPhysicsSystem (old voxel engine)
`useFarkleGame.ts` imports `VoxelPhysicsSystem` from `@match3d/game-core` (the old 3D voxel physics package). When the tile system is ported to 2D, this CORE file will require surgery. The coupling to `@match3d/game-core` must be extracted into an interface before surface work on the scene is safe.

### BV2 — farkleStore.ts (CORE) contains multiplier/banking logic
`commitChain()` in farkleStore implements the multiplier ladder and auto-bank logic. This is game balance logic inside a Zustand store — correctly classified as CORE, but MUST NOT be modified without running the full scoring test suite.

### BV3 — gameStore.ts (CORE) mixes session state with UI navigation state
`gameStore.ts` manages both `gamePhase` (CORE) and `activeScreen` (SURFACE navigation). Classified as CORE to be safe — do not extract until the two concerns are clearly separated.

### BV4 — useFarkleGame.ts (CORE) contains W1 violation: Math.random()
A CORE file contains a spec violation (D1). `_randomColumns()` uses `Math.random()` for doubler cell placement. Must be fixed before doubler cells are casino-compliant.

### BV5 — types.ts (CORE) exports old voxel EntityType constants
`packages/farkle-shared/src/types.ts` exports both Farkle constants and old voxel physics EntityType ('mirror', 'ghost', 'catalyst', 'sphere', etc.). These have no presence in the Farkle game description and should not coexist with canonical Farkle tile states.

---

## PART 4 — THE .ff-core-lock FILE CONTENT

```
# FARKLE FRENZY — CORE LOCK MANIFEST
# Generated: 2026-05-07
#
# Files listed here are CORE SACRED.
# They implement game balance, scoring, and fairness.
# DO NOT MODIFY without running the full test suite and getting explicit approval.
# Claude Code: if asked to modify a file in this list, STOP and ask the developer first.
#
# CORE FILES:
packages/farkle-shared/src/types.ts
packages/farkle-shared/src/index.ts
packages/farkle-engine/src/chainIndex.ts
packages/farkle-engine/src/farkleScorer.ts
packages/farkle-engine/src/farkleScorer.test.ts
packages/farkle-engine/src/csprng.ts
packages/farkle-engine/src/gridUtils.ts
packages/farkle-engine/src/floodFill.ts
packages/farkle-engine/src/monteCarlo.ts
packages/farkle-engine/src/rtpConfig.ts
packages/farkle-engine/src/index.ts
packages/farkle-engine/src/web.ts
apps/web/src/store/farkleStore.ts
apps/web/src/store/gameStore.ts
apps/web/src/hooks/useFarkleGame.ts
apps/server/src/gameRoom.ts
#
# SURFACE FILES (safe to modify visually and structurally):
apps/web/src/components/GameScreen.tsx
apps/web/src/components/FarkleHUD.tsx
apps/web/src/components/HUD.tsx
apps/web/src/components/HomeScreen.tsx
apps/web/src/components/MultiplayerLobby.tsx
apps/web/src/components/WinLoseScreen.tsx
apps/web/src/components/EstateScreen.tsx
apps/web/src/components/ShopScreen.tsx
apps/web/src/components/AgeGate.tsx
apps/web/src/components/SocialScreen.tsx
apps/web/src/components/EventBanner.tsx
apps/web/src/components/QuestPanel.tsx
apps/web/src/game/VoxelPileScene.tsx
apps/web/src/styles/bio-architect.css
apps/web/src/styles/tokens.ts
apps/web/src/styles/variants.ts
apps/web/src/App.tsx
apps/web/src/main.tsx
apps/web/src/data/levels.ts
apps/web/src/store/multiplayerStore.ts
apps/web/src/hooks/useMultiplayer.ts
apps/web/src/hooks/useEconomy.ts
apps/web/src/hooks/useLiveEvents.ts
apps/web/src/hooks/useQuests.ts
apps/server/src/index.ts
apps/server/src/sandbox.ts
```

---

## PART 5 — RECOMMENDED DIRECTORY RESTRUCTURE

The current structure is reasonable. The farkle-engine / farkle-shared / game-core split creates clear lines. Main confusion: `packages/game-core` (old voxel physics) and `packages/farkle-engine` are siblings with no clear signal for developers which is active.

**Recommended (rename only, no moves):**
- Rename `packages/game-core/` → `packages/voxel-legacy/` to signal it is the OLD system
- Add `packages/farkle-engine/src/constants.ts` to extract GAME_CONSTANTS and Heist constants out of the overcrowded types.ts

No full restructure is needed at this time.
