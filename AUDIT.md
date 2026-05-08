# FARKLE FRENZY V3 — FULL PRESERVATION AUDIT
# Generated: 2026-05-07 (updated for commits 83e94df2, fe1df052)

---

## SECTION A — VERIFIED PRESENT AND CORRECT

1. **Scoring engine exists** — `packages/farkle-engine/src/farkleScorer.ts` + `chainIndex.ts`. Uses lazy-initialized lookup table built from exhaustive internalScoreFarkle. Correctly handles all 6-tile special cases.

2. **Three 1s = 1000** — `chainIndex.ts`: `score += f === 1 ? threeOnesScore : f * 100` with `threeOnesScore = 1000`. ✓

3. **Two Triplets = 2500 (not 1200)** — `chainIndex.ts`: `if (counts.filter(c => c === 3).length === 2) return 2500;` ✓ Correctly handles W6 max-partition requirement.

4. **Straight = 1500** — `chainIndex.ts`: `if (counts.slice(1).every(c => (c ?? 0) === 1)) return 1500;` ✓

5. **Six of a Kind = 3000** — `chainIndex.ts`: `if (counts.some(c => c === 6)) return 3000;` ✓

6. **Three Pairs = 1500** — `chainIndex.ts` ✓

7. **Four of a Kind + Pair = 1500** — `chainIndex.ts` ✓

8. **Four of a Kind = 1000** — `chainIndex.ts`: `else if (c === 4) score += 1000;` ✓

9. **Five of a Kind = 2000** — `chainIndex.ts`: `if (c === 5) score += 2000;` ✓

10. **Single 1 = 100, Single 5 = 50** — `chainIndex.ts` ✓

11. **Multiplier ladder [1.0, 1.25, 1.5, 2.0, 3.0, 4.0]** — `packages/farkle-shared/src/types.ts` MULTIPLIER_LADDER ✓

12. **Multiplier cap at 4.0 (step 5)** — `farkleStore.ts` commitChain: `Math.min(s.multiplierStep + 1, 5)` ✓

13. **Chain-6 advances ladder; chain 2-5 auto-banks and resets** — `farkleStore.ts` commitChain and `gameRoom.ts` processChain ✓

14. **Farkle loses unbanked, resets multiplier, banked untouched** — `farkleStore.ts` commitChain: `unbanked: 0, multiplierStep: 0` on Farkle ✓

15. **8 game mode types defined** — `types.ts`: SOLO_FREE, SOLO_CASINO, VS_FREE, VS_CASINO, RALLY_FREE, RALLY_CASINO, HEIST_FREE, HEIST_CASINO ✓

16. **ENERGY_CONSTANTS: MAX=300, FRENZY_THRESHOLD=150** — `types.ts` ✓

17. **Energy tick via requestAnimationFrame** — `useFarkleGame.ts` ✓ (per PRESERVATION_SPEC W8 — NOT setInterval)

18. **PRIME passive energy gain +5/sec** — `useFarkleGame.ts` ✓

19. **FRENZY passive drain -5/sec** — `useFarkleGame.ts` ✓ (catchup correction missing, see B14)

20. **Chain-6 gains +10 energy in PRIME** — `farkleStore.ts` commitChain: CHAIN6_ENERGY_GAIN ✓

21. **Chains 2-5 cost -10 energy in PRIME** — `farkleStore.ts` PRIME_CHAIN_ENERGY_COST = -10 ✓

22. **FRENZY chain gains +10 energy** — `farkleStore.ts` FRENZY_CHAIN_ENERGY_GAIN = 10 ✓

23. **CSPRNG: HMAC-SHA256 implementation** — `csprng.ts`: `async hmac(key, data)` using Web Crypto API ✓

24. **Provably fair protocol: generateServerSeed, hashServerSeed, deriveCombinedSeed, verifyServerSeed** — `csprng.ts` ✓

25. **SixPoolManager: equal-distribution pool, poolSize = ceil(gridSize²/6)×6** — `gridUtils.ts` SixPoolManager constructor ✓

26. **Pool reshuffle on depletion** — `gridUtils.ts` drawDie() reshuffles when pool empties ✓

27. **Blocker density tiers: LOW=3-4, MEDIUM=5-7, HIGH=8-12** — `gridUtils.ts` BLOCKER_DENSITY_RANGES ✓

28. **Ice immune to adjacent chain clears** — `damageAdjacentBlockers` in gridUtils.ts only damages STONE cells ✓

29. **Lock Blockers immune to bombs** — `applyStandardBomb`: `if (cell.state === 'LOCKED') continue;` ✓

30. **Stone loses 1 HP per adjacent clear; Headhunter = 2 HP** — `damageAdjacentBlockers` ✓ (HP value wrong, see B3)

31. **Gravity: Stone, Ice, Lock do NOT fall** — `stepGravity` only moves NORMAL state dieTile or bomb cells ✓

32. **Bombs fall like die tiles** — `stepGravity` includes BOMB_STANDARD and BOMB_RAINBOW ✓

33. **Rainbow bomb: Red and Blue tiles score with multiplier** — `applyRainbowBomb`: `ptsEarned += rainbowRedReward * multiplier;` ✓

34. **Rainbow bomb: Lock immune** — `applyRainbowBomb`: `if (cell.state === 'LOCKED') continue;` ✓

35. **RALLY milestones: 10k=0.5x, 25k=1x, 50k=2x, 100k=5x** — `types.ts` RALLY_MILESTONES ✓

36. **Two currencies: FD (purple/blue) and PDX (emerald/amber)** — `types.ts` FD_COLORS, PDX_COLORS ✓

37. **CurrencyMode FD | PDX** — `types.ts` ✓

38. **Backtrack via second-to-last tile** — `useFarkleGame.ts` extendChain: `if (chain[chain.length - 2] === bodyId) { removeLastFromChain(); return; }` ✓

39. **Dead board detection and recovery stages** — `useFarkleGame.ts` _checkDeadBoard + `gridUtils.ts` hasValidChain ✓ (stage 2 partial, Wild not included — see B23)

40. **sql.js database in server** — `gameRoom.ts`: `import('sql.js')` ✓ (no better-sqlite3)

41. **RALLY and HEIST role assignment (server)** — `gameRoom.ts` assignRoles() assigns RAINMAKER/HEADHUNTER/ARCHIVIST/CONDUCTOR ✓

42. **Farkle Pool: lost unbanked enters farklePool** — `gameRoom.ts` processChain: `farklePool: this.state.farklePool + lost` ✓

43. **Grid scales with player count (server)** — `gameRoom.ts` explicit 7/8/9/10 mapping ✓

44. **Disruption system: ice_send, lock_send, scramble** — `gameRoom.ts` handleDisrupt, `types.ts` DisruptionType ✓

45. **Doubler cell system** — `farkleStore.ts` spawnDoublerCell/consumeDoublerCell ✓

46. **seededRng for non-casino (LCG-equivalent XOR-shift)** — `csprng.ts` ✓

47. **Max chain = 6 (non-FRENZY)** — MAX_CHAIN = 6; FRENZY correctly uncapped ✓

48. **Min chain = 2 (game-enforced)** — `gameRoom.ts` processChain: `chain.length < 2` ✓

49. **Multiplier catchup bonus +2 per chain when energy < 75** — `farkleStore.ts` FRENZY_CATCHUP_BONUS = 2 ✓ (drain-side not fixed — see B14)

50. **CONDUCTOR, RAINMAKER, ARCHIVIST, HEADHUNTER roles wired in client** — `useFarkleGame.ts` — roles have active code paths ✓ (correctness issues noted in B6/B7)

---

## SECTION B — PRESENT BUT INCORRECT OR INCOMPLETE

### B1 — DEAD-DICE RULE: INTENTIONAL DESIGN (NOT A BUG)
**STATUS: CONFIRMED INTENTIONAL**
- **Game design:** Any dead die (non-scoring face as single or pair) in a chain Farkles the entire chain. [1,1,1,2] → Farkle (0). This is stricter than standard Farkle and is a deliberate design choice — players must construct chains with no dead dice, making selection significantly more skillful.
- **Code correctly implements this** via `return 0` in `internalScoreFarkle()` dead-dice branches. Do not change.

### B2 — scoreFarkle ALWAYS RETURNS triggersBomb: null
**SEVERITY: CRITICAL**
- **Spec says:** Six-of-a-Kind triggers BOMB_STANDARD; Straight triggers BOMB_RAINBOW.
- **Code does:** `farkleScorer.ts` line 34: `triggersBomb: null` — hardcoded. Bombs never spawn from chain completion.
- **File:** `packages/farkle-engine/src/farkleScorer.ts`

### B3 — STONE SPAWN HEALTH: ALWAYS MAX (should be variable 1–3)
**SEVERITY: IMPORTANT** (downgraded — max HP = 3 is correct)
- **Design intent:** STONE_HP = 3 is the cap (correct). Stones should spawn with variable health (1, 2, or 3 HP) to create board variety.
- **Code was:** `makeStoneCell()` always spawned at health = STONE_HP (3). Fixed: now uses grid `rng` to randomize spawn HP in range [1, STONE_HP].
- **File:** `packages/farkle-engine/src/gridUtils.ts` makeStoneCell() — FIXED ✓

### B4 — BOMB_DIE_PTS = 25 (should be 100)
**SEVERITY: CRITICAL**
- **Spec says:** "Each normal die tile in the blast zone awards one hundred flat points"
- **Code does:** `types.ts` GAME_CONSTANTS BOMB_DIE_PTS: 25
- **Files:** `packages/farkle-shared/src/types.ts`, `packages/farkle-engine/src/gridUtils.ts` applyStandardBomb

### B5 — ARCHIVIST: WRONG MECHANIC
**SEVERITY: IMPORTANT**
- **Spec says:** Recovers 15% of Farkle Pool per chain automatically
- **Code does:** `useFarkleGame.ts` bankScore(): spawns +2 doubler cells on every 3rd bank. Doesn't touch farklePool.
- **Files:** `apps/web/src/hooks/useFarkleGame.ts` bankScore()

### B6 — CONDUCTOR ROLE: PARTIAL IMPLEMENTATION
**SEVERITY: IMPORTANT**
- **Spec says:** "Adds one extra multiplier step when choosing to Pass" (Rally mode)
- **Code does:** `useFarkleGame.ts`: gives +10 energy on chain-6. Rally Pass mechanic not implemented client-side (C2 missing feature).
- **File:** `apps/web/src/hooks/useFarkleGame.ts`

### B7 — RAINMAKER ROLE: PARTIAL IMPLEMENTATION
**SEVERITY: IMPORTANT**
- **Spec says:** "Chooses Rainbow Bomb target color instead of random"
- **Code does:** `useFarkleGame.ts`: gives +20% of net banked gain. No bomb color selection UI.
- **File:** `apps/web/src/hooks/useFarkleGame.ts`

### B8 — multiplayerGridSize() IN types.ts BROKEN
**SEVERITY: IMPORTANT**
- **Spec says:** 7/8/9/10 based on player count
- **Code does:** `types.ts`: `return playerCount === 1 ? 7 : 7;` — always returns 7. Correct version exists in gridUtils.ts.
- **File:** `packages/farkle-shared/src/types.ts`

### B9 — Math.random() IN _randomColumns() (GAME LOGIC)
**SEVERITY: CRITICAL (W1 violation)**
- **Spec says:** "Math.random() must NEVER be used for any game event"
- **Code does:** `useFarkleGame.ts`: `Math.floor(Math.random() * (i + 1))` inside `_randomColumns()` (doubler cell placement = game event).
- **File:** `apps/web/src/hooks/useFarkleGame.ts` ~line 444

### B10 — VS_CASINO HOUSE EDGE: platformFee = 0.02 (should be 0.08)
**SEVERITY: CRITICAL**
- **Spec says:** "8% of total pot (winner receives pot × 0.92)"
- **Code does:** `rtpConfig.ts`: VS_CASINO: { platformFee: 0.02 }
- **File:** `packages/farkle-engine/src/rtpConfig.ts`

### B11 — SixPoolManager: DISCARDS CSPRNG, USES LCG
**SEVERITY: CRITICAL**
- **Spec says:** ALL casino game events use HMAC-SHA256 CSPRNG
- **Code does:** `gridUtils.ts` SixPoolManager: takes CSPRNG param but extracts seed string and passes to seededRng() (LCG/XOR-shift). All shuffles use LCG.
- **File:** `packages/farkle-engine/src/gridUtils.ts` SixPoolManager constructor

### B12 — SERVER ENERGY SYSTEM: WRONG CONSTANTS AND NO PRIME/FRENZY
**SEVERITY: CRITICAL**
- **Spec says:** Energy 0-300, FRENZY_THRESHOLD=150, ±5/sec passive based on mode.
- **Code does:** `gameRoom.ts` startEnergyTick(): `p.energy = Math.max(0, p.energy - 1)` drains 1/sec. Players start at 150. No PRIME/FRENZY mode switching server-side.
- **File:** `apps/server/src/gameRoom.ts` startEnergyTick()

### B13 — LOCK TILES NOT CHAINABLE (client)
**SEVERITY: CRITICAL**
- **Spec says:** Lock Blockers must be chained to unlock
- **Code does:** `useFarkleGame.ts`: CHAINABLE set = `{'die', 'wild', 'mirror', 'catalyst'}` — 'lock' is absent.
- **File:** `apps/web/src/hooks/useFarkleGame.ts`

### B14 — FRENZY: CATCHUP DRAIN RATE NOT IMPLEMENTED
**SEVERITY: IMPORTANT**
- **Spec says:** "Players below seventy-five drain at only three per second"
- **Code does:** Always drains at -5/sec regardless of energy level.
- **File:** `apps/web/src/hooks/useFarkleGame.ts`

### B15 — WILD RESOLUTION: PLURALITY NOT EXHAUSTIVE 6^n SEARCH
**SEVERITY: IMPORTANT**
- **Spec says (PRESERVATION_SPEC Section 15):** Brute-force all 6^n face combinations where n = wild count.
- **Code does:** `_plurality()` uses majority-vote. Fails on [WILD, WILD, 3, 4, 5, 6] — should be Straight=1500, gets Three 3s=300.
- **File:** `apps/web/src/hooks/useFarkleGame.ts`

### B16 — WILD TILE GRAVITY: DOES NOT FALL
**SEVERITY: IMPORTANT**
- **Spec says:** Wild tiles should fall like die tiles.
- **Code does:** `makeWildCell()` sets `type: 'NONE'`. stepGravity excludes type=NONE. Wild tiles permanently anchored.
- **File:** `packages/farkle-engine/src/gridUtils.ts`

### B17 — FRENZY: CHAIN WITH WILD GAINS ONLY +10 (should be +20)
**SEVERITY: IMPORTANT**
- **Spec says:** "Any chain gains ten energy, or twenty with a Wild involved" (FRENZY)
- **Code does:** farkleStore.ts commitChain: no Wild detection.
- **File:** `apps/web/src/store/farkleStore.ts`

### B18 — PRIME CHAIN-6 WITH WILD: +20 energy (not +10)
**SEVERITY: IMPORTANT**
- **Spec says:** "A six-tile chain including a Wild Blocker gains twenty" (PRIME)
- **Code does:** CHAIN6_ENERGY_GAIN = 10 always, no Wild check.
- **File:** `apps/web/src/store/farkleStore.ts`

### B19 — FRENZY ANCHOR INSTABILITY WARNING: NOT IMPLEMENTED
**SEVERITY: IMPORTANT**
- **Spec says:** 2-second instability warning fires if anchor player drops below threshold before FRENZY can end.
- **Code does:** No anchor tracking, no instability warning. anchorPlayerId field exists in types.ts but unused.
- **Files:** `types.ts` EnergyState, `farkleStore.ts`

### B20 — MONTE CARLO: USES GREEDY SCORER (wrong normalizer)
**SEVERITY: CRITICAL**
- **Spec says:** Monte Carlo must use the same scorer as the game.
- **Code does:** `monteCarlo.ts` scoreFarkleLocal() uses per-face greedy. [1,1,1,2,2,2] → 1200 (not 2500). Miscalibrates normalizer.
- **File:** `packages/farkle-engine/src/monteCarlo.ts`

### B21 — MONTE CARLO: 1000 SESSIONS (spec requires 4000)
**SEVERITY: IMPORTANT**
- **Spec says:** "4000 simulated sessions minimum"
- **Code does:** `calibrateNormalizer(mode, sessions = 1000)` default 1000.
- **File:** `packages/farkle-engine/src/monteCarlo.ts`

### B22 — BOMBS IN BLAST RADIUS: NOT DESTROYED
**SEVERITY: IMPORTANT**
- **Spec says:** "Other bombs in the blast radius are destroyed but do not chain-detonate"
- **Code does:** applyStandardBomb handles STONE, ICE, isDieTile(). BOMB_STANDARD and BOMB_RAINBOW survive blast.
- **File:** `packages/farkle-engine/src/gridUtils.ts` applyStandardBomb()

### B23 — hasValidChain: IGNORES WILD TILES
**SEVERITY: IMPORTANT**
- **Spec says:** Wild tiles can contribute to scoring chains.
- **Code does:** hasValidChain() only starts BFS from isDieTile() cells, excluding Wild tiles.
- **File:** `packages/farkle-engine/src/gridUtils.ts`

### B24 — TEST SUITE CASES DON'T MATCH PRESERVATION_SPEC
**SEVERITY: IMPORTANT**
- **Spec says:** 16 mandatory test cases (see PRESERVATION_SPEC required_test_cases)
- **Code does:** farkleScorer.test.ts has 16 tests but different ones. Missing: [6,6,6]→600, [1,1,1,5]→1050, [1,1,1,5,5]→1100, [1,1,1,1]→1000, etc.
- **File:** `packages/farkle-engine/src/farkleScorer.test.ts`

### B25 — BOMB_CONSTANTS: OLD VOXEL SYSTEM VALUES
**SEVERITY: IMPORTANT (source of confusion)**
- BOMB_CONSTANTS.DIE_PTS = 25 (old voxel game), STONE_PTS = 100 (wrong — spec says 50).
- These are from old voxel physics system and should not coexist with Farkle constants.
- **File:** `packages/farkle-shared/src/types.ts`

### B26 — server/index.ts: WRONG GameRoom CONSTRUCTOR ARGS
**SEVERITY: IMPORTANT**
- `getOrCreateRoom()` calls `new GameRoom({ turnTimerSeconds: 30, seedPhrase: nanoid(32) })` — 30 not a valid timer value; seedPhrase not in LobbySettings.
- **File:** `apps/server/src/index.ts`

---

## SECTION C — MISSING ENTIRELY

### C1 — HEIST VAULT MECHANIC (entire feature)
- **What:** 70/30 vault split, 5000 vault threshold, heist initiation, 5-second block window, role modifiers
- **Description section:** "HEIST FREE introduces a vault mechanic"
- **Files needed:** `farkleStore.ts` (vault state), `useFarkleGame.ts` (heist logic), `gameRoom.ts` (heist server), `types.ts` (constants)

### C2 — RALLY Continue/Bank/Pass DECISION (client-side)
- **What:** Three-way player decision after each chain, 3-second reaction window, teammate voting
- **Description section:** "RALLY FREE is cooperative"
- **Files needed:** `farkleStore.ts` (pass state), new UI component, `useMultiplayer.ts`

### C3 — ARCHIVIST ROLE: Farkle Pool recovery per chain
- **What:** After each scoring chain, 15% of farklePool auto-recovered to unbanked
- **Description section:** Roles section
- **Files needed:** `useFarkleGame.ts` endChain, `farkleStore.ts`

### C4 — WILD SCATTER EVENT
- **What:** 3+ wilds on board → all players forced to FRENZY, tiles matching wilds' underlying faces destroyed board-wide
- **Description section:** "Wild Blockers are the most powerful special state"
- **Files needed:** `gridUtils.ts` (detection), `useFarkleGame.ts` or `gameRoom.ts` (trigger)

### C5 — AUDIO SYSTEM
- **What:** Synthesized sounds for all events, Howler-loaded ambient stems, crossfade by multiplier step and energy state
- **Description section:** "THE VISUAL AND AUDIO SYSTEM"
- **Files needed:** New audio package; COMPLETELY ABSENT

### C6 — RTP PAYOUT CALCULATION (casino modes)
- **What:** `payout = (sessionScore / normalizer) × betAmount`
- **Description section:** PRESERVATION_SPEC Section 6
- **Files needed:** `gameRoom.ts` (casino session end), payout service

### C7 — PROVABLY FAIR REVEAL MECHANISM
- **What:** Server reveals serverSeed after session; client verifies SHA-256(revealed) === committed hash
- **Description section:** "THE FAIRNESS GUARANTEE"
- **Files needed:** `gameRoom.ts` (seed reveal on session end), client verification UI

### C8 — 2D ISOMETRIC GEM CUBE TILE RENDERING
- **What:** 3-polygon SVG faces, face-color gradients, glow ring, chained tiles float/oscillate
- **Description section:** "THE VISUAL AND AUDIO SYSTEM"
- **Files needed:** New tile rendering component (currently using old 3D voxel physics)

### C9 — LOBBY→GAME TRANSITION ANIMATION
- **What:** "screen cracks, bleeds crimson, and shatters into obsidian"
- **Files needed:** Transition component

### C10 — BOMB FUSE VISUAL COUNTDOWN
- **What:** "three-second fuse countdown displayed as a draining ring" on bomb tiles
- **Files needed:** Tile rendering (bomb state visual)

### C11 — ENERGY_ZERO → AUTO-BANK ROUND END
- **What:** Energy reaching 0 auto-banks all unbanked and ends round
- **Description section:** "Energy reaching zero auto-banks and ends the round"
- **Files needed:** `useFarkleGame.ts` energy tick

### C12 — FNV-1A GEOMETRIC AVATAR GENERATION
- **What:** Deterministic avatar derived from username via FNV-1a hash
- **Files needed:** New avatar utility

### C13 — RALLY CASINO MILESTONE PAYOUTS (server)
- **What:** 10k=0.5×, 25k=1×, 50k=2×, 100k=5× pot milestone payments
- **Files needed:** `gameRoom.ts` (milestone tracking and payout)

### C14 — VS CASINO: WINNER TAKES POT LESS 8% HOUSE EDGE
- **What:** Session end: winner receives total pot × 0.92
- **Files needed:** `gameRoom.ts` (session end payout)

### C15 — 3D REACTION TIMER (RALLY)
- **What:** 3-second 3D timer after each chain; teammates vote Continue/Bank/Pass
- **Files needed:** New React component, websocket voting messages

### C16 — RTP DRIFT CORRECTION
- **What:** Running session RTP tracking; spawn weight ±5% to correct drift
- **Files needed:** `gameRoom.ts` or casino session manager

### C17 — KYC VERIFICATION FOR PDX REDEMPTION
- **What:** PDX is prize-eligible; requires KYC before redemption
- **Files needed:** KYC flow in compliance package

---

## SECTION D — VIOLATIONS OF PRESERVATION_SPEC (W1–W10)

### D1 — Math.random() IN GAME LOGIC (W1 VIOLATION)
- **File:** `apps/web/src/hooks/useFarkleGame.ts` ~line 444
- **Code:** `Math.floor(Math.random() * (i + 1))` in `_randomColumns()` (doubler cell placement = game event)
- **Rule:** "Math.random() must NEVER be used for any game event"
- **Severity: CRITICAL**

### D2 — Standard Bomb rewards MAY be multiplied (W2 RISK)
- Bomb score delegated to `VoxelPhysicsSystem.activateBomb()` — cannot verify flat award without reading that module.
- **Severity: IMPORTANT**

### D3 — BOMB_DIE_PTS = 25 (W2 VIOLATION — wrong flat value)
- **File:** `packages/farkle-shared/src/types.ts`
- **Rule:** Standard Bomb pays 100 flat per die tile
- **Severity: CRITICAL** (see B4)

### D4 — internalScoreFarkle: GREEDY DEAD-DICE BUG (W6 VIOLATION)
- **File:** `packages/farkle-engine/src/chainIndex.ts`
- **Rule:** "Greedy approaches will produce wrong scores"
- **Severity: CRITICAL** (see B1)

### D5 — SixPoolManager DISCARDS CSPRNG (W1 VIOLATION)
- **File:** `packages/farkle-engine/src/gridUtils.ts`
- **Rule:** Casino events must use HMAC-SHA256 CSPRNG
- **Severity: CRITICAL** (see B11)

### D6 — Monte Carlo uses wrong local scorer (W6 CONSEQUENCE)
- **File:** `packages/farkle-engine/src/monteCarlo.ts`
- **Rule:** Normalizer must be derived from accurate scoring
- **Severity: CRITICAL** (see B20)

### D7 — GameRoom energy tick: wrong constants
- **File:** `apps/server/src/gameRoom.ts` startEnergyTick()
- **Rule:** ±5/sec based on mode (spec); -1/sec (code)
- **Severity: CRITICAL** (see B12)

---

## SECTION E — DEPENDENCY MAP

```
packages/farkle-shared/src/types.ts
  └── (no imports — root types file)

packages/farkle-shared/src/index.ts
  └── re-exports types.ts

packages/farkle-engine/src/chainIndex.ts
  └── @match3d/farkle-shared (DieFace)

packages/farkle-engine/src/csprng.ts
  └── (no imports — uses Web Crypto API)

packages/farkle-engine/src/farkleScorer.ts
  └── @match3d/farkle-shared (DieFace)
  └── ./chainIndex.ts (lookupScore, buildScoreTable)

packages/farkle-engine/src/floodFill.ts
  └── @match3d/farkle-shared (Cell, GridPos)

packages/farkle-engine/src/gridUtils.ts
  └── @match3d/farkle-shared (Cell, DieFace, GridPos, LobbySettings, FACE_TO_COLOR, GAME_CONSTANTS)
  └── ./csprng.ts (CSPRNG, seededRng)
  └── ./chainIndex.ts (lookupScore, buildScoreTable)
  └── nanoid

packages/farkle-engine/src/rtpConfig.ts
  └── @match3d/farkle-shared (GameMode, RTPConfig)

packages/farkle-engine/src/monteCarlo.ts
  └── @match3d/farkle-shared (GameMode)
  └── ./csprng.ts (seededRng)
  └── ./rtpConfig.ts (RTP_CONFIGS)

packages/farkle-engine/src/index.ts
  └── re-exports all engine modules

packages/farkle-engine/src/web.ts
  └── re-exports farkleScorer, chainIndex, csprng (NOT gridUtils)

apps/server/src/gameRoom.ts
  └── @match3d/farkle-shared (Cell, Player, GamePhase, LobbySettings, GAME_CONSTANTS)
  └── @match3d/farkle-engine (CSPRNG, createGrid, SixPoolManager, scoreFarkle)
  └── nanoid, ws, sql.js

apps/server/src/index.ts
  └── ./gameRoom.ts, ./sandbox.ts, express, ws, nanoid

apps/web/src/store/farkleStore.ts
  └── @match3d/farkle-shared (EntityType, DisruptionEvent, DoublerCell, RallyRole)
  └── zustand

apps/web/src/store/multiplayerStore.ts
  └── @match3d/farkle-shared (DisruptionEvent, RallyRole)
  └── zustand

apps/web/src/hooks/useFarkleGame.ts
  └── @match3d/farkle-engine (buildScoreTable, lookupScore)
  └── @match3d/farkle-shared (DieFace, LevelDef, GameMode, SPAWN_WEIGHTS, CATALYST_WILD_BOOST, CATALYST_MAX_BOOST)
  └── @match3d/game-core (VoxelPhysicsSystem)  ← OLD VOXEL SYSTEM — COUPLING RISK
  └── ../store/farkleStore.ts

apps/web/src/components/GameScreen.tsx
  └── useFarkleGame (hook), VoxelPhysicsSystem, FarkleHUD

apps/web/src/store/gameStore.ts
  └── @match3d/game-core (GameState, LevelConfig, etc.)  ← OLD VOXEL SYSTEM
  └── @match3d/farkle-shared (GameMode)
```

**Critical cascade:** `chainIndex.ts → farkleScorer.ts → gameRoom.ts (server)` and `chainIndex.ts → farkleScorer.ts → farkleStore.ts → useFarkleGame.ts → GameScreen.tsx`. Any change to chainIndex.ts or types.ts cascades to every scoring call.

---

## SECTION F — SUMMARY SCORES

```
Scoring engine integrity:        6/10  (core algorithm solid; dead-dice bug B1, triggersBomb=null B2)
Game mode completeness:          3/10  (8 modes typed; HEIST 0%, RALLY 30%, casino 10%)
Energy system correctness:       5/10  (ladder/drain correct; catchup-drain, Wild energy, anchor missing)
Blocker type completeness:       5/10  (Stone HP wrong, Lock unchainable, Wild no gravity)
Bomb mechanics correctness:      4/10  (structure right; die_pts wrong, no bomb-in-blast destroy, no spawn trigger)
Multiplier ladder correctness:   9/10  (values correct; cap correct; applies cleanly)
Currency system completeness:    6/10  (types defined; payout math absent)
Chain mechanic correctness:      6/10  (backtrack correct; FRENZY unlimited confirmed OK; Wild resolution suboptimal)
Visual system completeness:      3/10  (bio-architect CSS; no isometric tiles; no bomb visuals; old 3D voxel)
Audio system completeness:       0/10  (COMPLETELY ABSENT)
```

**Overall preservation score: 4/10**

The Farkle Frenzy V3 codebase is architecturally sound but functionally incomplete. The scoring engine has a dead-dice bug that silently Farkle-kills any mixed chain containing non-scoring faces — this makes the game unplayable to spec. Roles are partially wired (roles exist in code but with different mechanics than specified). Four of eight game modes are 0% implemented on the server. The audio system does not exist. The casino infrastructure (payout, provably fair reveal, RTP drift correction, KYC) is designed but not built. The SixPoolManager discards the CSPRNG in favor of an LCG, breaking casino fairness. Despite all this, the multiplier ladder, pool system, CSPRNG math, and WebSocket server skeleton are close to correct and worth preserving.
