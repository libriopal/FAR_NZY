// ═══════════════════════════════════════════════════════
// FARKLE FRENZY — CORE SACRED FILE
// This file implements game balance, scoring, or fairness logic.
// DO NOT MODIFY without:
//   1. Running all 16 farkleScorer test cases
//   2. Running npx tsc --noEmit (must show 0 errors)
//   3. Explicit developer approval
//   4. Updating DECISIONS_LOCKED_v4.txt if any constant changes
// See .ff-core-lock for full classification manifest.
// ═══════════════════════════════════════════════════════

import type { GameMode, DieFace, RallyRole } from '@match3d/farkle-shared';
import {
  MULTIPLIER_LADDER,
  SPAWN_WEIGHTS,
  RALLY_MILESTONES,
  GAME_CONSTANTS,
  BOMB_CONSTANTS,
  ENERGY_CONSTANTS,
} from '@match3d/farkle-shared';
import { seededRng } from './csprng.js';
import { RTP_CONFIGS } from './rtpConfig.js';
import { lookupScore, buildScoreTable } from './chainIndex.js';

// ─── Existing interface and lazy table (unchanged) ────────────────────────────

export interface MonteCarloResult {
  averageScore: number;
  farkleRate: number;
  normalizer: number;
  sessionsRun: number;
}

let _mcTable: Int32Array | null = null;
function getMcTable(): Int32Array {
  if (!_mcTable) _mcTable = buildScoreTable();
  return _mcTable;
}

// ─── V2 types (inline until Batch B promotes to farkle-shared/types.ts) ───────

export type PlayerModel = 'OPTIMAL' | 'AVERAGE' | 'WEAK';

export interface SimConfig {
  mode: GameMode;
  sessions: number;
  maxTurns: number;
  playerModel: PlayerModel;
  blockerDensity: 'LOW' | 'MEDIUM' | 'HIGH';
  playerCount: 1 | 2 | 3 | 4;
  rolesActive: boolean;
  roles: RallyRole[];
  seed: number;
  stakeAmount?: number;
}

export interface MonteCarloResultV2 {
  averageScore:               number;
  farkleRate:                 number;
  normalizer:                 number;
  sessionsRun:                number;
  p95Score:                   number;
  p5Score:                    number;
  variance:                   number;
  stdDev:                     number;
  baseChainRTP:               number;
  multiplierContributionRTP:  number;
  orbContributionRTP:         number;
  doublerContributionRTP:     number;
  archivistContributionRTP:   number;
  bombStandardRTP:            number;
  bombRainbowRTP:             number;
  milestonePayout:            number;
  bombStandardRate:           number;
  bombRainbowRate:            number;
  orbActivationRate:          number;
  doublerTriggerRate:         number;
  deadBoardRecoveryRate:      number;
  multiplierStepDistribution: Record<0|1|2|3|4|5, number>;
  roleContribution:           Partial<Record<RallyRole, number>>;
  milestoneHitRate:           Partial<Record<1|2|3|4, number>>;
  voteOutcomeDistribution:    { continue: number; bank: number; pass: number };
  playerModel:                PlayerModel;
  seed:                       number;
  config:                     string;
}

// ─── V2 simulation constants ──────────────────────────────────────────────────

// Approximate board composition at PRIME on 7×7 grid
const BOARD_DIE_TILES   = 30;  // ~die-type tiles on board
const BOMB_RADIUS_TILES = 9;   // 3×3 standard blast area
const DISTINCT_FACES    = 5;   // typical distinct face values present

// Energy changes ±5/s; ~10s per turn → ±50 per turn
const ENERGY_PER_TURN = 50;

// Stone HP uses server constant (HP=2), not client constant (HP=3)
const _STONE_HP = GAME_CONSTANTS.STONE_HP; // 2

// ─── V2 helper functions ──────────────────────────────────────────────────────

function detectBombTrigger(roll: DieFace[]): null | 'BOMB_STANDARD' | 'BOMB_RAINBOW' {
  const sorted = [...roll].sort((a, b) => a - b);
  if (sorted.every((v, i) => v === i + 1)) return 'BOMB_RAINBOW'; // Straight [1-6]
  const counts = new Map<number, number>();
  for (const f of roll) counts.set(f, (counts.get(f) ?? 0) + 1);
  let max = 0;
  for (const c of counts.values()) if (c > max) max = c;
  if (max >= 5) return 'BOMB_STANDARD'; // Five-of-a-Kind or Six-of-a-Kind
  return null;
}

function playerContinue(
  model: PlayerModel,
  unbanked: number,
  multiplierStep: number,
  rng: () => number,
): boolean {
  // Optimal: continue when multiplier gain outweighs farkle risk
  // Breakeven at farkleRate≈0.37: continue when unbanked < ~4000 or step < 4
  const optimal = multiplierStep < 4 || unbanked < 4054;
  switch (model) {
    case 'OPTIMAL': return optimal;
    case 'AVERAGE': return rng() < 0.70 ? optimal : rng() < 0.50;
    case 'WEAK':    return rng() < 0.40 ? optimal : rng() < 0.30;
  }
}

function standardBombYield(
  role: RallyRole | null,
  model: PlayerModel,
  multiplierStep: number,
  rng: () => number,
): number {
  const mult = MULTIPLIER_LADDER[multiplierStep] ?? 1.0;
  if (role === 'RAINMAKER') {
    const targetRed =
      model === 'OPTIMAL' ? true :
      model === 'AVERAGE' ? rng() < 0.70 :
      rng() < 0.40;
    const redTiles = Math.round(BOARD_DIE_TILES / 6);
    if (targetRed) {
      // Global blast, all RED tiles: ~5 tiles × 100 + self 25
      return Math.round((BOMB_CONSTANTS.SELF_PTS + redTiles * BOMB_CONSTANTS.DIE_PTS_ONE) * mult);
    }
    // Random non-RED face → expected ~25 + 5 × 1/6 × 100
    return Math.round((BOMB_CONSTANTS.SELF_PTS + redTiles * BOMB_CONSTANTS.DIE_PTS_ONE / 6) * mult);
  }
  // Standard radius blast: ~9 tiles, ~1/6 RED + 1/6 BLUE + self
  const radialYield = BOMB_CONSTANTS.SELF_PTS
    + Math.round(BOMB_RADIUS_TILES * (BOMB_CONSTANTS.DIE_PTS_ONE + BOMB_CONSTANTS.DIE_PTS_FIVE) / 6);
  return Math.round(radialYield * mult);
}

function rainbowBombYield(multiplierStep: number, rng: () => number): number {
  // Target face: uniform random from distinct faces present (server model: score × mult)
  const mult = MULTIPLIER_LADDER[multiplierStep] ?? 1.0;
  const facePick = rng() * DISTINCT_FACES;
  const tileCount = Math.round(BOARD_DIE_TILES / 6); // ~5 tiles per face
  if (facePick < 1) return Math.round(tileCount * 100 * mult); // RED selected
  if (facePick < 2) return Math.round(tileCount * 50 * mult);  // BLUE selected
  return 0;
}

function simulateRallyVote(
  role: RallyRole | null,
  model: PlayerModel,
  multiplierStep: number,
  unbanked: number,
  rng: () => number,
): 'continue' | 'bank' | 'pass' {
  if (model === 'OPTIMAL') {
    if (multiplierStep >= 3 && unbanked > 10_000) return 'bank';
    return 'continue';
  }
  if (model === 'AVERAGE') {
    const r = rng();
    return r < 0.55 ? 'continue' : r < 0.90 ? 'bank' : 'pass';
  }
  // WEAK
  const r = rng();
  return r < 0.30 ? 'continue' : r < 0.90 ? 'bank' : 'pass';
}

function checkMilestones(
  banked: number,
  hit: Set<number>,
  isRallyCasino: boolean,
  stakeAmount: number,
  onHit: (tier: number, payout: number) => void,
): void {
  if (!isRallyCasino) return;
  for (const m of RALLY_MILESTONES) {
    if (banked >= m.points && !hit.has(m.tier)) {
      hit.add(m.tier);
      onHit(m.tier, Math.round(stakeAmount * m.multiplier));
    }
  }
}

// ─── V2 Monte Carlo simulation ────────────────────────────────────────────────

export async function runMonteCarloV2(config: SimConfig): Promise<MonteCarloResultV2> {
  const {
    mode,
    sessions,
    maxTurns  = 30,
    playerModel,
    rolesActive = false,
    roles       = [],
    seed,
    stakeAmount = 0,
  } = config;

  const table         = getMcTable();
  const isRally       = mode.includes('RALLY');
  const isRallyCasino = mode === 'RALLY_CASINO';

  // Session score array (for p5/p95 — sorted once at end)
  const sessionScores = new Array<number>(sessions).fill(0);

  // Cross-session accumulators (all integers — Math.round applied inline)
  let totalScore            = 0;
  let totalFarkles          = 0;
  let totalBombStd          = 0;
  let totalBombRainbow      = 0;
  let totalOrbActivations   = 0;
  let totalDoublerTriggers  = 0;
  let totalDeadBoardRecov   = 0;

  let totalBaseChain        = 0;
  let totalMultBonus        = 0;
  let totalOrbBonus         = 0;
  let totalDoublerBonus     = 0;
  let totalArchivistBonus   = 0;
  let totalBombStdScore     = 0;
  let totalBombRainbowScore = 0;
  let totalMilestonePayout  = 0;

  // Multiplier step distribution (one slot per step 0-5)
  const stepCounts: [number,number,number,number,number,number] = [0,0,0,0,0,0];
  let totalTurns = 0;

  // Rally vote distribution
  let totalVoteCont = 0;
  let totalVoteBank = 0;
  let totalVotePass = 0;

  // Role contribution accumulators
  const roleContribAccum: Partial<Record<RallyRole, number>> = {};

  // Milestone hit rate accumulators
  const milestoneHitAccum: Record<1|2|3|4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  const CHUNK = 10_000;
  const masterRng = seededRng(seed);

  for (let base = 0; base < sessions; base += CHUNK) {
    const end = Math.min(base + CHUNK, sessions);

    for (let i = base; i < end; i++) {
      // Per-session CSPRNG derivation (Section 2.1)
      const sessionSeed = Math.floor(masterRng() * 0x7FFF_FFFF);
      const diceRng     = seededRng(sessionSeed ^ 0xAA_BB_CC);
      const boardRng    = seededRng(sessionSeed ^ 0x11_22_33);
      const bonusRng    = seededRng(sessionSeed ^ 0x44_55_66);
      const decisionRng = seededRng(sessionSeed ^ 0x77_88_99);

      // Session state
      let banked             = 0;
      let unbanked           = 0;
      let farklePool         = 0;
      let multiplierStep     = 0;
      let bankCount          = 0;
      let explicitBanks      = 0;
      let energy             = 0;
      let doublerActive      = false;
      let doublerExpiresTurn = 0;

      // Role for this session
      const role: RallyRole | null =
        rolesActive && roles.length > 0 ? (roles[i % roles.length] ?? null) : null;

      const milestoneHit = new Set<number>();

      // Per-session contribution deltas
      let sessBase      = 0;
      let sessMult      = 0;
      let sessOrb       = 0;
      let sessDoubler   = 0;
      let sessArchivist = 0;
      let sessBombStd   = 0;
      let sessBombRbw   = 0;
      let sessMilestone = 0;

      let sFarkles  = 0;
      let sBombStd  = 0;
      let sBombRbw  = 0;
      let sOrb      = 0;
      let sDoubler  = 0;

      for (let turn = 0; turn < maxTurns; turn++) {
        // Energy progression (±50/turn, clamp to [0, MAX])
        if (energy < ENERGY_CONSTANTS.FRENZY_THRESHOLD) {
          energy = Math.min(energy + ENERGY_PER_TURN, ENERGY_CONSTANTS.MAX);
        } else {
          energy = Math.max(energy - ENERGY_PER_TURN, 0);
          if (energy === 0 && unbanked > 0) {
            // Auto-bank on energy depletion
            banked += unbanked;
            unbanked = 0;
            multiplierStep = 0;
            bankCount++;
          }
        }

        const energyMode =
          energy >= ENERGY_CONSTANTS.FRENZY_THRESHOLD ? 'FRENZY' : 'PRIME';
        const spawnW = SPAWN_WEIGHTS[energyMode];

        // Doubler expiry check
        if (doublerActive && turn >= doublerExpiresTurn) doublerActive = false;

        // Roll 6d6 via diceRng stream
        const roll: DieFace[] = [
          (Math.floor(diceRng() * 6) + 1) as DieFace,
          (Math.floor(diceRng() * 6) + 1) as DieFace,
          (Math.floor(diceRng() * 6) + 1) as DieFace,
          (Math.floor(diceRng() * 6) + 1) as DieFace,
          (Math.floor(diceRng() * 6) + 1) as DieFace,
          (Math.floor(diceRng() * 6) + 1) as DieFace,
        ];

        const rawScore = lookupScore(roll, table);

        if (rawScore === 0) {
          // Farkle
          farklePool += unbanked;
          unbanked = 0;
          multiplierStep = 0;
          sFarkles++;
          stepCounts[0]++;
          totalTurns++;
          continue;
        }

        const bombTrig = detectBombTrigger(roll);
        const mult     = MULTIPLIER_LADDER[multiplierStep] ?? 1.0;
        const scaledScore = Math.round(rawScore * mult);
        const baseContrib = rawScore;             // at ×1.0
        const multContrib = scaledScore - rawScore;

        stepCounts[multiplierStep as 0|1|2|3|4|5]++;
        totalTurns++;

        const doesContinue = playerContinue(playerModel, unbanked, multiplierStep, decisionRng);

        if (doesContinue) {
          // Chain-6 path: advance multiplier, accumulate unbanked
          unbanked      += scaledScore;
          sessBase      += baseContrib;
          sessMult      += multContrib;
          multiplierStep = Math.min(multiplierStep + 1, 5);

          // Multiplier orb (chain-6 continue): spawn via boardRng
          const orbPresent = boardRng() < (spawnW.multiplier_orb / 100);
          if (orbPresent) {
            const useProb = playerModel === 'OPTIMAL' ? 1.0
              : playerModel === 'AVERAGE'             ? 0.80 : 0.50;
            if (decisionRng() < useProb && unbanked > 0) {
              const orbBonus = Math.round(unbanked * 0.5);
              unbanked    += orbBonus;
              sessOrb     += orbBonus;
              sOrb++;
            }
          }

          // Doubler (chain-6 with active doubler)
          if (doublerActive) {
            const useProb = playerModel === 'OPTIMAL' ? 1.0
              : playerModel === 'AVERAGE'             ? 0.65 : 0.30;
            if (decisionRng() < useProb) {
              const dblBonus = scaledScore; // doubler doubles the chain contribution
              unbanked      += dblBonus;
              sessDoubler   += dblBonus;
              sDoubler++;
            }
          }

          // ARCHIVIST bonus on successful chain-6 (RALLY modes)
          if (isRally && role === 'ARCHIVIST' && farklePool > 0) {
            const archBonus = Math.round(farklePool * GAME_CONSTANTS.ARCHIVIST_PCT);
            unbanked       += archBonus;
            sessArchivist  += archBonus;
            roleContribAccum['ARCHIVIST'] =
              (roleContribAccum['ARCHIVIST'] ?? 0) + archBonus;
          }

          // Rally vote simulation
          if (isRally) {
            const vote = simulateRallyVote(role, playerModel, multiplierStep, unbanked, decisionRng);
            if (vote === 'continue') {
              totalVoteCont++;
            } else if (vote === 'bank') {
              totalVoteBank++;
              banked        += unbanked;
              unbanked       = 0;
              multiplierStep = 0;
              bankCount++;
              explicitBanks++;
              checkMilestones(banked, milestoneHit, isRallyCasino, stakeAmount,
                (tier, payout) => {
                  sessMilestone += payout;
                  milestoneHitAccum[tier as 1|2|3|4]++;
                });
              if (banked >= 100_000) break;
            } else {
              totalVotePass++;
              // CONDUCTOR gets +1 multiplierStep on pass
              if (role === 'CONDUCTOR') {
                multiplierStep = Math.min(multiplierStep + 1, 5);
                // Attribute the ladder gain to CONDUCTOR
                const conductorGain = Math.round(
                  1500 * ((MULTIPLIER_LADDER[multiplierStep] ?? 1.0) - (MULTIPLIER_LADDER[multiplierStep - 1] ?? 1.0)),
                );
                roleContribAccum['CONDUCTOR'] =
                  (roleContribAccum['CONDUCTOR'] ?? 0) + conductorGain;
              }
            }
          }

        } else {
          // Bank path: realise score, reset
          unbanked      += scaledScore;
          sessBase      += baseContrib;
          sessMult      += multContrib;
          banked        += unbanked;
          unbanked       = 0;
          multiplierStep = 0;
          bankCount++;
          explicitBanks++;

          // Doubler spawn every 3rd explicit bank
          if (explicitBanks % 3 === 0) {
            doublerActive      = true;
            doublerExpiresTurn = turn + 3; // 30s ÷ 10s/turn = 3 turns
          }

          checkMilestones(banked, milestoneHit, isRallyCasino, stakeAmount,
            (tier, payout) => {
              sessMilestone += payout;
              milestoneHitAccum[tier as 1|2|3|4]++;
            });
          if (banked >= 100_000) break;
        }

        // ── Bomb simulation ──────────────────────────────────────────────────

        // 1. Chain-triggered bomb (deterministic from dice composition)
        if (bombTrig === 'BOMB_STANDARD') {
          const bScore = standardBombYield(role, playerModel, multiplierStep, bonusRng);
          banked       += bScore;
          sessBombStd  += bScore;
          sBombStd++;
          if (role === 'HEADHUNTER') {
            // HEADHUNTER: double stone damage = kills stone in 1 hit vs 2
            // Extra stone score = STONE_PTS × (1 − 1/_STONE_HP) per stone in blast
            const stoneBonus = Math.round(BOMB_CONSTANTS.STONE_PTS * (1 - 1 / _STONE_HP));
            roleContribAccum['HEADHUNTER'] =
              (roleContribAccum['HEADHUNTER'] ?? 0) + stoneBonus;
            banked += stoneBonus;
          }
        } else if (bombTrig === 'BOMB_RAINBOW') {
          const rScore = rainbowBombYield(multiplierStep, boardRng);
          banked       += rScore;
          sessBombRbw  += rScore;
          sBombRbw++;
        }

        // 2. Board-spawn bomb trigger (probabilistic, uses bonusRng stream)
        if (bombTrig === null && bonusRng() < spawnW.bomb / 100) {
          const bScore = standardBombYield(role, playerModel, multiplierStep, bonusRng);
          banked       += bScore;
          sessBombStd  += bScore;
          sBombStd++;
        }
        if (bombTrig === null && bonusRng() < spawnW.rainbow_bomb / 100) {
          const rScore = rainbowBombYield(multiplierStep, boardRng);
          banked       += rScore;
          sessBombRbw  += rScore;
          sBombRbw++;
        }
      }

      // Carry any remaining unbanked at session end
      banked += unbanked;

      sessionScores[i] = banked;
      totalScore            += banked;
      totalFarkles          += sFarkles;
      totalBombStd          += sBombStd;
      totalBombRainbow      += sBombRbw;
      totalOrbActivations   += sOrb;
      totalDoublerTriggers  += sDoubler;
      totalBaseChain        += sessBase;
      totalMultBonus        += sessMult;
      totalOrbBonus         += sessOrb;
      totalDoublerBonus     += sessDoubler;
      totalArchivistBonus   += sessArchivist;
      totalBombStdScore     += sessBombStd;
      totalBombRainbowScore += sessBombRbw;
      totalMilestonePayout  += sessMilestone;
    }

    // Yield event loop between chunks (non-blocking)
    if (end < sessions) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  // ── Aggregate results ─────────────────────────────────────────────────────

  const averageScore = totalScore / sessions;
  const farkleRate   = totalFarkles / sessions;
  const normalizer   = averageScore / (RTP_CONFIGS[mode]?.targetRTP ?? 0.92);

  // p5/p95: sort once at end (not per-session)
  const sorted   = [...sessionScores].sort((a, b) => a - b);
  const p5Score  = sorted[Math.floor(sessions * 0.05)] ?? 0;
  const p95Score = sorted[Math.floor(sessions * 0.95)] ?? 0;

  // Variance / stdDev (integer results)
  let varAccum = 0;
  for (const s of sessionScores) varAccum += (s - averageScore) ** 2;
  const variance = Math.round(varAccum / sessions);
  const stdDev   = Math.round(Math.sqrt(variance));

  // RTP attribution as fractions of total score
  const denom = totalScore || 1;
  const toRTP = (n: number) => Number((n / denom).toFixed(4));

  // Multiplier step distribution
  const tt = totalTurns || 1;
  const multiplierStepDistribution: Record<0|1|2|3|4|5, number> = {
    0: Number((stepCounts[0] / tt).toFixed(4)),
    1: Number((stepCounts[1] / tt).toFixed(4)),
    2: Number((stepCounts[2] / tt).toFixed(4)),
    3: Number((stepCounts[3] / tt).toFixed(4)),
    4: Number((stepCounts[4] / tt).toFixed(4)),
    5: Number((stepCounts[5] / tt).toFixed(4)),
  };

  // Role contribution as fraction of total score
  const roleContribution: Partial<Record<RallyRole, number>> = {};
  for (const [r, v] of Object.entries(roleContribAccum) as [RallyRole, number][]) {
    roleContribution[r] = Number((v / denom).toFixed(4));
  }

  // Milestone hit rate (fraction of sessions hitting each tier)
  const milestoneHitRate: Partial<Record<1|2|3|4, number>> = {
    1: Number((milestoneHitAccum[1] / sessions).toFixed(4)),
    2: Number((milestoneHitAccum[2] / sessions).toFixed(4)),
    3: Number((milestoneHitAccum[3] / sessions).toFixed(4)),
    4: Number((milestoneHitAccum[4] / sessions).toFixed(4)),
  };

  const totalVotes = (totalVoteCont + totalVoteBank + totalVotePass) || 1;

  return {
    averageScore:               Math.round(averageScore),
    farkleRate:                 Number(farkleRate.toFixed(4)),
    normalizer:                 Number(normalizer.toFixed(4)),
    sessionsRun:                sessions,
    p5Score,
    p95Score,
    variance,
    stdDev,
    baseChainRTP:               toRTP(totalBaseChain),
    multiplierContributionRTP:  toRTP(totalMultBonus),
    orbContributionRTP:         toRTP(totalOrbBonus),
    doublerContributionRTP:     toRTP(totalDoublerBonus),
    archivistContributionRTP:   toRTP(totalArchivistBonus),
    bombStandardRTP:            toRTP(totalBombStdScore),
    bombRainbowRTP:             toRTP(totalBombRainbowScore),
    milestonePayout:            Math.round(totalMilestonePayout / sessions),
    bombStandardRate:           Number((totalBombStd      / sessions).toFixed(4)),
    bombRainbowRate:            Number((totalBombRainbow  / sessions).toFixed(4)),
    orbActivationRate:          Number((totalOrbActivations  / sessions).toFixed(4)),
    doublerTriggerRate:         Number((totalDoublerTriggers / sessions).toFixed(4)),
    deadBoardRecoveryRate:      Number((totalDeadBoardRecov  / sessions).toFixed(4)),
    multiplierStepDistribution,
    roleContribution,
    milestoneHitRate,
    voteOutcomeDistribution: {
      continue: Number((totalVoteCont / totalVotes).toFixed(4)),
      bank:     Number((totalVoteBank / totalVotes).toFixed(4)),
      pass:     Number((totalVotePass / totalVotes).toFixed(4)),
    },
    playerModel,
    seed,
    config: JSON.stringify({ mode, sessions, maxTurns, playerModel, seed }),
  };
}

// ─── Existing exports (backward compat — UNCHANGED) ───────────────────────────

// Lazy-initialized table — uses the same max-partition scorer as the live game (W6 compliance).
export function calibrateNormalizer(
  mode: GameMode,
  sessions: number = 4000
): MonteCarloResult {
  const table = getMcTable();
  let totalScore = 0;
  let totalFarkles = 0;

  for (let i = 0; i < sessions; i++) {
    let score = 0;
    let chainCount = 0;
    const rng = seededRng(i);

    while (score < 50000 && chainCount < 30) {
      const roll = Array.from({ length: 6 }, () => (Math.floor(rng() * 6) + 1) as DieFace);
      const chainScore = lookupScore(roll, table);
      if (chainScore === 0) {
        totalFarkles++;
        break;
      }
      score += chainScore;
      chainCount++;
    }

    totalScore += score;
  }

  const averageScore = totalScore / sessions;
  const farkleRate = totalFarkles / sessions;
  const normalizer = averageScore / RTP_CONFIGS[mode].targetRTP;

  return {
    averageScore,
    farkleRate,
    normalizer,
    sessionsRun: sessions,
  };
}

export function runMonteCarlo(mode: GameMode, sessions: number = 4000): MonteCarloResult {
  return calibrateNormalizer(mode, sessions);
}
