# Update Plan — Block F: Bio-Architect Design System + Competitive Gaps

Status: COMPLETE (2026-05-07)

---

## Block F — Bio-Architect Design System

### F1 — Design Token Foundation — COMPLETE
- [x] `apps/web/src/styles/bio-architect.css`
- [x] `apps/web/src/styles/tokens.ts`
- [x] `apps/web/src/styles/variants.ts`
- [x] `apps/web/src/main.tsx`

### F2 — Global Shell + HomeScreen — COMPLETE
- [x] `HomeScreen.tsx` — marble gradient, glassmorphism cards, variant switcher

### F3 — GameScreen + FarkleHUD — COMPLETE
- [x] `GameScreen.tsx`, `FarkleHUD.tsx`

### F4 — Shop + Estate — COMPLETE
- [x] `ShopScreen.tsx`, `EstateScreen.tsx`

### F5 — Social + Win/Lose — COMPLETE
- [x] `SocialScreen.tsx`, `WinLoseScreen.tsx`

### F6 — Variant Switcher UI — COMPLETE
- [x] HomeScreen variant toggle

---

## Competitive Gaps (from COMPETITIVE_DESIGN_BRIEF.md)

### GAP 1 — Active Disruption System — COMPLETE
- [x] `farkle-shared/types.ts` — `DisruptionType`, `DisruptionEvent`
- [x] `VoxelPhysicsSystem.ts` — `sendDisruption(targetColumns, type)`
- [x] `apps/server/src/gameRoom.ts` — `DISRUPT` handler + `handleDisrupt()`
- [x] `useMultiplayer.ts` — `sendDisruption()` + `DISRUPTION_INCOMING` → `lastDisruption`
- [x] `farkleStore.ts` — `disruptions`, `pendingDisruption`, `addDisruption`, `dismissDisruption`
- [x] `FarkleHUD.tsx` — `DisruptionToast` component

### GAP 2 — Doubler Cells — COMPLETE
- [x] `farkle-shared/types.ts` — `DoublerCell`
- [x] `farkleStore.ts` — `doublerCells`, `spawnDoublerCell`, `consumeDoublerCell`
- [x] `VoxelPileScene.tsx` — `DoublerCellPanels` (cyan glow floor panels)
- [x] `useFarkleGame.ts` — doubler ×2 applied + consumed in `endChain`

### GAP 6 — Revenue Architecture — COMPLETE
- [x] `packages/economy/src/index.ts` — `BattlePassTier`, `BATTLE_PASS_TIERS`, `'battle_pass_reward'` TransactionType
- [x] `useEconomy.ts` — `claimBattlePassTier(tierDef)`
- [x] `ShopScreen.tsx` — Blueprint Pass section, 10 tiers, T5/T10 SC milestones

---

## Post-Block-F Build Target
0 TS errors · 730+ modules · all screens using Bio-Architect tokens
