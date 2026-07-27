# 2026-07 3D Renderer Archive (ADR-024/025 2D Pivot)

## What this is

The Rapier3D/Three.js game-board renderer that ran the Farkle board before the
2D pivot (`docs/adr/ADR-024-gap1b-option1-server-authoritative-board.md` and
the follow-up ADR-025 grid-native entity model). Archived, not deleted —
preserved as DNA per this project's "don't delete, archive" convention.

- **`VoxelPileScene.tsx`** — the `@react-three/fiber` scene component:
  board/tile rendering, chain-selection drag UI (raycasting-based), falling-
  dice animation, bomb/particle effects, camera rig. Originally
  `apps/web/src/game/VoxelPileScene.tsx`.
- **`VoxelPhysicsSystem.ts`** — the Rapier3D physics simulation driving it:
  column-stack model (continuous `column` + world-space `position`, no
  `row`/grid concept), local seeded RNG for entity/face rolls, bomb/mirror/
  ghost/ice/lock mechanics as direct method calls. Originally
  `packages/game-core/src/systems/VoxelPhysicsSystem.ts`.

## Why it was archived

This renderer's client ran an **independent** physics simulation with its own
local randomness — structurally decoupled from the server's authoritative
`Cell[][]` grid (`packages/farkle-engine/src/gridUtils.ts`). Production
multiplayer play submitted client-asserted die faces (`SUBMIT_CHAIN_FACES`)
that the server only shape-validated, never cross-checked against its own
grid — this was BUG-01 / GAP-1b, a real client-side scoring-exploit gap
(documented in `docs/adr/ADR-023-gap1b-server-face-validation.md`).

Closing it properly meant making the client render the server's actual grid
directly instead of running a parallel physics simulation — i.e., a 2D,
grid-native renderer (`apps/web/src/game/Board2DScene.tsx`, PixiJS v8) rather
than a 3D one. The exploit couldn't be closed by patching this renderer in
place; the architecture itself had to change.

## What replaced it

- `apps/web/src/game/Board2DScene.tsx` — PixiJS v8 renderer, consumes the
  server's/`SoloEngine`'s `Cell[][]` directly.
- `apps/web/src/game/soloEngine.ts` — client-local grid engine for solo mode
  (no server to be authoritative over in single-player).
- `packages/farkle-engine/src/boardEngine.ts` — server-side board-tick engine
  (consume scored chain, settle gravity, refill).
- `core/apps/server/src/gameRoom.ts`'s merged `processChain()` — the sole
  scoring path now (`SUBMIT_CHAIN`, row/col-validated); `processChainFaces()`/
  `SUBMIT_CHAIN_FACES` were deleted, not just deprecated.

## How to resurrect

1. Move both files back to their original paths (`apps/web/src/game/
   VoxelPileScene.tsx`, `packages/game-core/src/systems/
   VoxelPhysicsSystem.ts`).
2. Re-add `export * from './systems/VoxelPhysicsSystem.js';` to
   `packages/game-core/src/index.ts`.
3. `three`, `@react-three/fiber`, `@react-three/drei`,
   `@dimforge/rapier3d-compat` are still present in `apps/web/package.json` —
   they weren't removed, since `apps/web/src/game/WildCubeEngine.ts` (a
   separate, already-orphaned 3D feature, out of scope for this archival)
   still imports them.
4. `useFarkleGame.ts` and `GameScreen.tsx` would need to be reverted or
   re-adapted to call back into `VoxelPhysicsSystem`/`VoxelPileScene` instead
   of the grid-native model — they are not drop-in compatible with the
   archived files' old `physicsRef`/`tapSphere`/body-id-based API, since the
   hook's public interface changed shape as part of this pivot.

**Archived at commit:** `c01d03c5e4a916dc7e70f98550bd6af53788f8a9` (the `core`
submodule's HEAD immediately before this pivot's work began), on branch
`feat/p7-gap1b-2d-board-authority`.
