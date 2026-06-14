# monteCarlo.ts Return Path Coverage Checklist
# Every item must map to a confirmed code line before Batch A closes.
# Status: UNVERIFIED until Batch A implementation + tsc + test pass.

## BASE SCORING (lookupScore — already modelled)
- [ ] Ones: 100 each, 1000 for three → lookupScore()
- [ ] Fives: 50 each, 500 for three → lookupScore()
- [ ] Three of a Kind → lookupScore()
- [ ] Four of a Kind → lookupScore()
- [ ] Five of a Kind → lookupScore()
- [ ] Six of a Kind → lookupScore()
- [ ] Straight [1,2,3,4,5,6] → lookupScore()
- [ ] Two Triplets → lookupScore()
- [ ] Three Pairs → lookupScore()
- [ ] 4+Pair → lookupScore()
- [ ] Farkle (zero score) → farklePool accumulation

## MULTIPLIER LADDER
- [ ] scaledScore = score × MULTIPLIER_LADDER[multiplierStep]
- [ ] Advance on chain-6: multiplierStep = min(step+1, 5)
- [ ] Reset on bank (chain < 6): multiplierStep = 0
- [ ] Reset on farkle: multiplierStep = 0
- [ ] Distribution tracked: multiplierStepDistribution[0..5]

## BOMB MECHANICS — STANDARD
- [ ] Trigger: Six-of-a-Kind chain → standard bomb spawns
- [ ] Self-score: +25 pts (BOMB_CONSTANTS.SELF_PTS)
- [ ] Die face=1 in radius: +100 pts each
- [ ] Die face=5 in radius: +50 pts each
- [ ] Other face: 0 pts
- [ ] Stone in radius: +50 pts if destroyed (HP=2 server constant)
- [ ] Ice in radius: 0 pts (tile clears)
- [ ] Score applied at current multiplierStep (server model)
- [ ] bombStandardRate tracked (triggers per session)
- [ ] bombStandardRTP contribution accumulated

## BOMB MECHANICS — RAINBOW
- [ ] Trigger: Straight chain → rainbow bomb spawns
- [ ] Target face: random draw from distinct faces on board via boardRng
- [ ] Global blast — not radius limited
- [ ] face=1 selected: +100 × multiplierStep per tile (server model)
- [ ] face=5 selected: +50 × multiplierStep per tile (server model)
- [ ] Other face selected: 0 pts
- [ ] bombRainbowRate tracked
- [ ] bombRainbowRTP contribution accumulated

## BOMB MECHANICS — RAINMAKER (Rally only)
- [ ] Intercepts standard bomb: player targets face=1 (RED) if present
- [ ] OPTIMAL: always face=1; AVERAGE: face=1 at 70%; WEAK: face=1 at 40%
- [ ] Global blast (same as rainbow, not radius) when RAINMAKER active
- [ ] RTP delta vs non-RAINMAKER baseline tracked in roleContribution

## BONUS MECHANICS
- [ ] Multiplier orb: orbBonus = round(unbanked × 0.5) on chain-6 continue
- [ ] Orb only non-zero when unbanked > 0 (chain-6 continue path only)
- [ ] orbActivationRate tracked
- [ ] orbContributionRTP accumulated
- [ ] Doubler cell: spawns every 3rd explicit bank
- [ ] Doubler column: bonusRng-derived, 30s duration modelled as N turns
- [ ] Doubler effect: doubles scaled score for chains through active column
- [ ] doublerTriggerRate tracked
- [ ] doublerContributionRTP accumulated

## ENERGY SYSTEM
- [ ] PRIME (energy < 150): spawn weights NORMAL/PRIME applied
- [ ] FRENZY (energy ≥ 150): bomb weight=7, rainbow_bomb=1 applied
- [ ] Energy=0: auto-bank triggers (unbanked → banked, turn ends)
- [ ] Spawn weights affect bomb/rainbow trigger probability per turn

## BOARD TILE EFFECTS
- [ ] Stone HP=2 (server constant — not client HP=3)
- [ ] Stone reduces board space → modelled as reduced chain option probability
- [ ] Ice tiles: unchainable → modelled as chain length reduction
- [ ] Dead board recovery: seeded face injection via boardRng (not hardcoded)
- [ ] deadBoardRecoveryRate tracked

## RALLY ROLES
- [ ] ARCHIVIST: archivistBonus = round(farklePool × 0.15) per chain
- [ ] ARCHIVIST: individual benefit only (not team-wide)
- [ ] ARCHIVIST: archivistContributionRTP accumulated
- [ ] HEADHUNTER: stone damage = 2 per bomb hit (vs 1 baseline)
- [ ] HEADHUNTER: disruption charge rate = 2× base
- [ ] HEADHUNTER: indirect RTP via faster stone clear modelled
- [ ] CONDUCTOR: +1 multiplierStep on pass action
- [ ] CONDUCTOR: multiplierStep advance via pass not via chain-6
- [ ] RAINMAKER: see BOMB MECHANICS — RAINMAKER above
- [ ] roleContribution tracked per role per session

## RALLY FLOW
- [ ] Vote window: 3-player simulated votes per model (continue/bank/pass)
- [ ] Tie-break: continue > pass > bank
- [ ] continue: same player continues, multiplierStep preserved
- [ ] bank: handleBank called, multiplierStep reset
- [ ] pass: nextTurn, multiplierStep preserved (CONDUCTOR: +1 step)
- [ ] voteOutcomeDistribution tracked

## RALLY CASINO MILESTONES
- [ ] Shared banked pool (room-level, not per-player)
- [ ] Tier 1: banked ≥ 10,000 → payout = stakeAmount × 0.5
- [ ] Tier 2: banked ≥ 25,000 → payout = stakeAmount × 1.0
- [ ] Tier 3: banked ≥ 50,000 → payout = stakeAmount × 2.0
- [ ] Tier 4: banked ≥ 100,000 → payout = stakeAmount × 5.0
- [ ] Each tier fires once per session (milestoneHit Set)
- [ ] milestonePayout accumulated (integer pts)
- [ ] milestoneHitRate tracked per tier

## HEIST VAULT
- [ ] 70/30 split: vaultPts += round(scaled × 0.70), unbanked += remainder
- [ ] Vault claim: vaultPts → banked on explicit claim or expiry
- [ ] Net RTP neutral at session level (redistribution only)
- [ ] vaultPts tracked separately in SimSession state

## CSPRNG LINEAGE (every random event must use correct stream)
- [ ] Die face draws → diceRng (sessionSeed ^ 0xAA_BB_CC)
- [ ] Board tile type draws → boardRng (sessionSeed ^ 0x11_22_33)
- [ ] Orb/doubler spawn events → bonusRng (sessionSeed ^ 0x44_55_66)
- [ ] Player decision draws → decisionRng (sessionSeed ^ 0x77_88_99)
- [ ] Rainbow bomb face draw → boardRng (board-state resolution event)
- [ ] No Math.random() anywhere in monteCarlo.ts

## RESULT FIELDS (MonteCarloResultV2 — all must be populated)
- [ ] averageScore
- [ ] farkleRate
- [ ] normalizer
- [ ] sessionsRun
- [ ] p95Score
- [ ] p5Score
- [ ] variance
- [ ] stdDev
- [ ] baseChainRTP
- [ ] multiplierContributionRTP
- [ ] orbContributionRTP
- [ ] doublerContributionRTP
- [ ] archivistContributionRTP
- [ ] bombStandardRTP
- [ ] bombRainbowRTP
- [ ] milestonePayout
- [ ] bombStandardRate
- [ ] bombRainbowRate
- [ ] orbActivationRate
- [ ] doublerTriggerRate
- [ ] deadBoardRecoveryRate
- [ ] multiplierStepDistribution (all 6 steps)
- [ ] roleContribution (per active role)
- [ ] milestoneHitRate (tiers 1-4)
- [ ] voteOutcomeDistribution
- [ ] playerModel
- [ ] seed
- [ ] config (JSON hash of SimConfig)

When Batch A implementation begins, every checkbox above must be ticked
with a line reference (e.g. monteCarlo.ts:142) before the sacred file
authorization is granted.

## OWC (Opportunity Weight Controller — P4)

These paths are added by P4-OWC when `owcParams.enabled = true` in SimConfig.
OWC is computed in packages/owc/src/index.ts and applied in sandbox.ts before
the simulation run. The paths below require sacred file changes to be wired into
monteCarlo.ts directly (deferred — authorization needed).

### OWC SANDBOX LAYER (surface — implemented)
- [x] OWCParams accepted by POST /simulate → owcParams field
- [x] computeWeights() called with mode, playerRank, currentRTP, farkleRate
- [x] spawnWeightAdjustments merged with manual patch weights (manual wins)
- [x] owcContributionRTP returned in simulation result
- [x] owcReason string returned for logging/debugging
- [x] POST /owc-weights endpoint — direct weight computation without simulation

### OWC SLIPSTREAM (VS / Heist — surface layer)
- [x] Trailing player (rank ≥ 2) gets face_1 boost up to +12%
- [x] face_5 boost = face_1 × 0.5
- [x] slipstreamFactor = 1 + boost returned to caller
- [x] Boost scales with trailingDepth × matchProgress (ramps over 20 turns)
- [x] Leader (rank=1) gets zero adjustment

### OWC RALLY BALANCE (cooperative — surface layer)
- [x] If running RTP < targetRTP by >2%, face_1 bias applied
- [x] Correction magnitude = shortfall × 0.15

### OWC RTP DRIFT CORRECTION (all modes — surface layer)
- [x] RTP running high (>3% above target): face_1 bias reduced
- [x] RTP running low (>3% below target): face_5 bias increased
- [x] Only active after 5+ turns to avoid early-session noise

### OWC FARKLE RATE STABILISER (all modes — surface layer)
- [x] Farkle rate > 22%: reduce face_2/face_3 bias (easier grid)
- [x] Farkle rate < 8% (after 5 turns): increase face_2 bias (harder grid)

### SACRED FILE INTEGRATION (complete — merged PR #3, 2026-06-14)
- [x] SimConfig extended with `owcParams?: OWCConfig` in types.ts (SACRED) → types.ts:266
- [x] runMonteCarloV2() accepts OWCConfig and applies per-turn weight adjustment → monteCarlo.ts:366
- [x] owcContributionRTP field added to MonteCarloResultV2 (SACRED) → monteCarlo.ts:83
- [x] owcErrorCount field added — systemic errors observable in audit output → monteCarlo.ts:84
- [x] CSPRNG lineage: biasedFaceDraw() uses one diceRng() call per die (same as uniform) → monteCarlo.ts:205
- [x] OWC param bounds clamped: playerCount [1,4], playerRank [1,playerCount] → monteCarlo.ts:252
- [x] All 6 gate thresholds re-validated after OWC integration (seed=42, 50k sessions: PASS)
