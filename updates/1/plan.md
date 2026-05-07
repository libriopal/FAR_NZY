# Update Plan — Phases 10-15

Status: COMPLETE (2026-05-07)

---

## Fixed (pre-phase work)
- [x] Build was broken — 5 TS errors in EventBanner.tsx + GameScreen.tsx. Fixed:
  - `colors` possibly-undefined in EventBanner (inline fallback object)
  - Missing `type` field in VoxelTransform→FarkleBody map (GameScreen.tsx:36)
  - Wrong prop name `onSphereTap` → `onEntityTap` on VoxelPileScene (GameScreen.tsx:120)
- [x] Build: 0 TypeScript errors, 25.38s, 721+ modules

---

## Phase 10 — Live Events Deep System
- [x] `useLiveEvents.ts` — daily/weekly/bonus-weekend event windows, claim via economy, analytics (already done in prior session)
- [x] `EventBanner.tsx` — collapsed/expanded reward cards, toast feedback (already done)
- [x] **Seasonal event type** — added `'seasonal_challenge'` to LiveEvent.type; active first 7 days of each month; +2000 gold +100 SC +50 bio-steel reward
- [x] **Persist claims to Supabase** — dual write: localStorage (fast path) + savePlayerData sync on every claim
- [x] **EventBanner on HomeScreen** — EventBanner wired above QuestPanel with import

## Phase 11 — Advanced Monetization Tuning ✓
- [x] `ShopScreen.tsx` — LTO banner: 3 rotating bundles (Starter Boost/Vine Pack/Dome Bundle), 48h countdown, purple highlight
- [x] `ShopScreen.tsx` — "First Purchase Bonus": 3× badge on cheapest tier when goldCoins ≤ 500 (starter balance)
- [x] `WinLoseScreen.tsx` — reward scaling: score ≥ 50k = 1.5× gold; score ≥ 100k = 2× gold + 5 SC bonus; visual badge shown

## Phase 12 — A/B Testing + Analytics Completeness ✓
- [x] `packages/analytics/src/index.ts` — `setAbGroup(group)` + `getAbGroup()` added; deterministic A/B/C bucket from userId hash in `configure()`
- [x] `abGroup` attached as default field on every BatchedEvent
- [x] Cohort: `first_session_date` persisted to localStorage on first configure call; `daysSinceInstall` computed and attached to all events
- [x] `firstSessionDate` + `daysSinceInstall` fields added to BatchedEvent type

## Phase 13 — Content Pipeline: Level Config + Entity Weights ✓
- [x] `packages/farkle-shared/src/types.ts` — `LevelDef` type exported: `{ id, name, spawnWeights, winScore, timeLimitSec, energyMultiplier }`
- [x] `apps/web/src/data/levels.ts` — 10 level configs (Seedling Plot → Grand Blueprint); winScore 25k→100k; progressive spawn weights
- [x] `useFarkleGame.ts` — accepts optional `LevelDef`; applies spawnWeights + winScore + energyMultiplier
- [x] `HomeScreen.tsx` + `gameStore.ts` — level selector grid (1-10), stores `selectedLevelId`; `GameScreen.tsx` reads it
- [x] `DEFAULT_LEVEL` = level 10 (Grand Blueprint, 100k, Frenzy-weights)

## Phase 14 — Guild System Completion ✓
- [x] `packages/backend-client/src/index.ts` — `createGuild`, `joinGuild`, `leaveGuild`, `getTopGuilds`, `getGuildLeaderboard` added
- [x] `SocialScreen.tsx` — full GuildPanel with 4 views: main/browse/create/detail; create form with name+tag; join/leave buttons; member leaderboard; live Supabase fetch with DEMO_TOP_GUILDS fallback

## Phase 15 — Performance + PWA Polish ✓
- [x] `vite.config.ts` — rapier split into dedicated `'rapier'` named chunk (was bundled with game-core; now separate 2MB chunk)
- [x] VitePWA already configured in vite.config.ts (selfDestroying=true pending CI terser toolchain)

---

## Validation — COMPLETE ✅ (2026-05-07)
Ran: `~/MATCH3D/updates/2/validate_farkle_frenzy_preservation.md`

**All 10 sections PASS.** Two bugs found and fixed during validation:
- [x] **FRENZY unlimited chains** — `extendChain` was capping at MAX_CHAIN=6 even in FRENZY. Fixed: skip cap when `mode === 'FRENZY'`
- [x] **NORMAL mode single-die only** — chains were allowed in NORMAL. Fixed: `startChain` blocks non-1/non-5 faces; `extendChain` returns immediately in NORMAL

Final build: 0 TS errors, 727 modules, 19.26s. Engine: 16/16 tests pass.
