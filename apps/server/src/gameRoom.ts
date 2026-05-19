// ═══════════════════════════════════════════════════════════════════════════
// gameRoom.ts — SERVER-SIDE GAME LOOP AUTHORITY  (Sacred Core)
// ═══════════════════════════════════════════════════════════════════════════
//
// AUDITOR OVERVIEW
// ─────────────────
// This is the single authoritative source of truth for all scoring,
// banking, win conditions, and payouts. The client (web app) is display-only
// and cannot manipulate any of these values.
//
// FULL MULTIPLAYER GAME LOOP (message sequence):
//
//   CLIENT                          SERVER (this file)
//   ──────                          ──────────────────
//   CREATE_ROOM ──────────────────▶ getOrCreateRoom() in index.ts
//   JOIN_ROOM   ──────────────────▶ addPlayer()        → ROOM_STATE
//   START_GAME  ──────────────────▶ handleStartGame()  → GAME_STARTED
//   SUBMIT_CHAIN ─────────────────▶ handleMessage() → processChain()
//     if farkle + token:            → COMBO_BREAKER_FIRED + CHAIN_RESULT
//     if real farkle:               → CHAIN_RESULT (phase=FARKLE_ANIM) → nextTurn()
//     if score (chain<6, auto-bank):→ CHAIN_RESULT + ROOM_STATE + (win?) SESSION_END
//     if score (chain=6, continue): → CHAIN_RESULT + ROOM_STATE + timer restart
//   BANK        ──────────────────▶ handleBank()       → ROOM_STATE + (win?) SESSION_END
//   PASS        ──────────────────▶ nextTurn()         → TURN_CHANGE
//   turn timer expires              handleBank(activePlayerId) — forced bank
//
// PROVABLE FAIRNESS CHAIN:
//   1. constructor: seed = nanoid(32), committedHash = SHA-256(seed) stored
//   2. hashServerSeed broadcasts the hash to all players BEFORE first roll
//   3. endSession: reveals the raw seed — any player can verify hash matches
//   This is a commit-reveal scheme: seed was fixed before game started.
//   See: csprng.ts (RNG) and hashServerSeed() in farkle-engine.
//
// RTP / PAYOUT FORMULA (per mode):
//   SOLO_CASINO   → (playerBanked / levelWinScore) × stakeAmount × targetRTP
//   VS_CASINO     → highestBanked wins → totalPot × targetRTP
//   RALLY_CASINO  → highestBanked wins → totalPot × targetRTP
//   HEIST_CASINO  → highestBanked wins → totalPot × targetRTP
//   *_FREE modes  → payout=0 (no real money wagered)
//   targetRTP values are in rtpConfig.ts (typically 0.92 = 92%)
//
// SKILL-DEPENDENCY PROOF:
//   Every chain decision (BANK/CONTINUE, farkle risk %, optimal flag) is
//   written to analytics.ts → chain_decisions table. Downstream queries can
//   correlate was_optimal=true decisions with win rates to prove skill matters.
//
// GRAPHICAL SKIN NOTES:
//   All visual state is in getPublicState(). Skins read grid, phase,
//   multiplierStep, energy, trickStreak, vault. Nothing here needs changing
//   to reskin the game — only the web app (VoxelPileScene, FarkleHUD) does.
//
// FILES THAT DEPEND ON THIS:
//   index.ts          WebSocket handler that calls GameRoom methods
//   analytics.ts      insertChainDecision / insertSession persistence
//   multiplayerStore.ts  client-side state mirror of getPublicState()
//
// ─── SACRED FILE — see modification rules at top ───────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// FARKLE FRENZY — CORE SACRED FILE
// This file implements game balance, scoring, or fairness logic.
// DO NOT MODIFY without:
//   1. Running all 16 farkleScorer test cases
//   2. Running npx tsc --noEmit (must show 0 errors)
//   3. Explicit developer approval
//   4. Updating DECISIONS_LOCKED_v4.txt if any constant changes
// See .ff-core-lock for full classification manifest.
// ═══════════════════════════════════════════════════════

import type { WebSocket } from 'ws';
import type { Cell, Player, GamePhase, LobbySettings } from '@match3d/farkle-shared';
import { GAME_CONSTANTS, RALLY_MILESTONES, ENERGY_CONSTANTS, getMultiplier, HEIST_CONSTANTS, ANTE_SCHEDULES } from '@match3d/farkle-shared';
import { CSPRNG, createGrid, SixPoolManager, scoreFarkle, hashServerSeed, estimateFarkleRisk, isOptimalDecision, RTP_CONFIGS, applyEventHorizon, resolveComboBreaker, EVENT_HORIZON_EARN_THRESHOLD, MAX_TOKENS, applyGravityFlip, seededRng, applyFlowMultiplier, tickRhythmAccuracy, INITIAL_RHYTHM_STATE, computeSlipstream, applyFacetToScore, startFacetDraft, pickFacet as _pickFacet, skipFacetDraft, tickFacetRound, INITIAL_FACET_STATE, applyActiveRuleShard, activateShard, tickShard, tryEarnShard, INITIAL_SHARD_STATE } from '@match3d/farkle-engine';
import type { BeatAccuracy, RhythmState, SlipstreamState, FacetState, FacetId, FacetContext, RuleShardState, ShardId, ShardContext } from '@match3d/farkle-engine';
import { insertChainDecision, insertSession, insertWalletTransaction } from './analytics.js';
import { nanoid } from 'nanoid';

// ── Types ─────────────────────────────────────────────────────────────────────

// One connected player: WebSocket handle + game profile + energy level.
// profile.banked is the authoritative per-player score used for win detection.
// energy drives the PRIME/FRENZY spawn-weight transition (see startEnergyTick).
interface RoomPlayer {
  ws: WebSocket;
  profile: Player;   // profile.banked = this player's running banked total
  energy: number;    // 0–300; ≥150 = FRENZY threshold (ENERGY_CONSTANTS)
}

// Shared room state broadcast to all clients after every scoring event.
// unbanked: accumulated this turn, lost on farkle.
// banked: room aggregate (sum of all players' banks this session).
// multiplierStep: 0–5 index into MULTIPLIER_LADDER (6-chain streak bonus).
// farklePool: unbanked points lost to farkle (display only; not redistributed).
interface GameRoomState {
  grid: Cell[][];
  phase: GamePhase;    // IDLE | CHAINING | FARKLE_ANIM | GAME_OVER | …
  unbanked: number;    // current turn's unbanked score — LOST on farkle
  banked: number;      // room total banked (sum across all players)
  multiplierStep: number;
  farklePool: number;
}

// ── DB ────────────────────────────────────────────────────────────────────────
// NOTE: This is an in-memory sql.js DB used for room/score snapshots.
// It is SEPARATE from the persistent analytics SQLite DB in analytics.ts.
// The analytics DB (chain_decisions, sessions tables) is the compliance record.
// This DB is ephemeral — lost on server restart. Do not rely on it for audits.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

async function getDb() {
  if (db) return db;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initSqlJs = (await import('sql.js' as any)).default;
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      state TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      player_id TEXT,
      score INTEGER,
      mode TEXT,
      achieved_at INTEGER
    );
  `);
  return db;
}

// ── GameRoom ──────────────────────────────────────────────────────────────────
// One instance per active room. Created by index.ts on CREATE_ROOM message.
// Destroyed (garbage collected) when isEmpty() returns true after cleanup interval.

export class GameRoom {
  readonly id: string;
  private players: Map<string, RoomPlayer> = new Map();  // playerId → RoomPlayer
  private activePlayerId: string | null = null;          // whose turn it is
  private state: GameRoomState;
  private pool: SixPoolManager;    // manages the 6-sided face pool + spawn weights
  private csprng: CSPRNG;          // seeded PRNG — all randomness flows through here
  private settings: LobbySettings; // levelWinScore, stakeAmount, turnTimerSeconds, etc.
  private turnTimer: ReturnType<typeof setTimeout> | null = null;      // auto-bank on expiry
  private energyInterval: ReturnType<typeof setInterval> | null = null; // ticks every 200ms
  private gameMode: string = 'VS_FREE';                  // set by index.ts before first player joins
  private roleMap: Map<string, string> = new Map();      // RALLY/HEIST role assignments
  private committedHash: Promise<string>;  // SHA-256(seed) — committed BEFORE first roll; revealed at SESSION_END
  private milestonesHit: Map<string, Set<number>> = new Map(); // RALLY_CASINO tier payouts already fired
  private sessionEnded = false;            // guard: prevents double endSession calls
  private rallyDecisionTimeout: ReturnType<typeof setTimeout> | null = null;
  private sessionId = nanoid();            // FK for analytics chain_decisions and sessions tables
  private sessionStartedAt = new Date().toISOString();
  // Analytics counters — written to sessions table at SESSION_END
  private totalChains = 0;    // every SUBMIT_CHAIN received (including farkles)
  private scoringChains = 0;  // chains that produced score > 0
  private banksTaken = 0;     // auto-bank events from chain.length < 6
  private lastActionAt: Map<string, number> = new Map(); // rate-limit: INPUT_LOCK_MS between submissions
  private readonly INPUT_LOCK_MS = 100;  // 100ms minimum between SUBMIT_CHAIN messages
  // pipeline.ts mechanics (per-player, keyed by playerId):
  private playerTokens: Map<string, number> = new Map();              // Combo Breaker token balance (0–MAX_TOKENS)
  private playerEventHorizonStreaks: Map<string, number> = new Map(); // consecutive banks since last farkle
  private vaultTotal: number = 0;       // HEIST: running vault accumulation
  private heistInitiatorId: string | null = null;   // playerId currently running a heist, or null
  private heistExpiresAt: number | null = null;      // epoch ms when the block window closes
  private heistTimer: ReturnType<typeof setTimeout> | null = null; // fires _resolveHeist on expiry
  private rallyPot: number = 0;    // RALLY mode: running total of all banks; split evenly at session end
  private bankCycleCount: number = 0;  // total banks across all players; every 5 triggers Gravity Flip
  private antesPaidByPlayer: Map<string, number> = new Map(); // playerId → cumulative ante paid this session
  private anteTotalCollected: number = 0; // sum of all antes from all players this session

  // ── constructor ─────────────────────────────────────────────────────────────
  // Called once when CREATE_ROOM arrives. Grid is seeded and hash committed here
  // so the fairness proof is established before any player joins.
  constructor(settings: LobbySettings) {
    this.id = nanoid(8).toUpperCase();
    this.settings = settings;
    // FAIRNESS: seed is 32 random chars from nanoid (192 bits of entropy).
    // The CSPRNG wraps this seed; all grid spawns and pool draws use it.
    this.csprng = new CSPRNG(nanoid(32));
    // SixPoolManager normalises face-frequency to maintain configurable RTP.
    this.pool = new SixPoolManager(settings.playerCount, this.csprng);
    // Grid size scales with player count: more players → larger grid → more chains.
    const gridDim = settings.playerCount === 1 ? 7
      : settings.playerCount === 2 ? 8
      : settings.playerCount === 3 ? 9 : 10;
    this.state = {
      grid: createGrid(gridDim, settings, this.pool),
      phase: 'IDLE',
      unbanked: 0,
      banked: 0,
      multiplierStep: 0,
      farklePool: 0,
    };
    // COMMIT-REVEAL: SHA-256 of the seed is stored as a Promise.
    // It will be broadcast to clients in SESSION_END alongside the raw seed.
    // Players can independently compute SHA-256(seed) and verify it matches.
    this.committedHash = hashServerSeed(this.csprng.getSeed());
    // Energy tick and turn timer start in handleStartGame, not here (#2, #8)
  }

  private broadcast(msg: object) {
    const data = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.ws.readyState === 1) p.ws.send(data);
    }
  }

  private send(ws: WebSocket, msg: object) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  // Auto-bank the active player's unbanked score when turn time expires.
  // This prevents a player from stalling indefinitely with accumulated points.
  private startTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => {
      this.handleBank(this.activePlayerId ?? '');
    }, (this.settings.turnTimerSeconds ?? 15) * 1000);
  }

  // Energy tick — runs every 200ms (= 5 ticks/sec) after START_GAME.
  // BELOW FRENZY_THRESHOLD (150): energy climbs → better spawn weights (PRIME tier).
  // AT/ABOVE FRENZY_THRESHOLD:   energy drains → eventually hits 0 → ENERGY_ZERO event.
  // Energy_ZERO is a visual/audio cue; it does not currently end the turn.
  // For skin builders: ENERGY_UPDATE fires every 200ms with current energy value.
  private startEnergyTick() {
    if (this.energyInterval) return;
    const TICK_MS = 200;
    this.energyInterval = setInterval(() => {
      for (const [id, p] of this.players.entries()) {
        const inFrenzy = p.energy >= ENERGY_CONSTANTS.FRENZY_THRESHOLD;
        const delta = inFrenzy ? -1 : 1; // per 200ms tick = 5/sec
        p.energy = Math.max(0, Math.min(ENERGY_CONSTANTS.MAX, p.energy + delta));
        if (p.energy === 0) {
          this.broadcast({ type: 'ENERGY_ZERO', playerId: id });
        }
        this.broadcast({ type: 'ENERGY_UPDATE', playerId: id, energy: p.energy });
      }
    }, TICK_MS);
  }

  addPlayer(ws: WebSocket, playerId: string, playerName: string) {
    const player: Player = {
      id: playerId,
      name: playerName,
      banked: 0,
      isActive: false,
      vote: null,
      isConnected: true,
    };
    this.players.set(playerId, { ws, profile: player, energy: 150 });

    // Track first player as active; turn timer starts only on START_GAME (#2)
    if (!this.activePlayerId) {
      this.activePlayerId = playerId;
    }

    this.send(ws, { type: 'ROOM_STATE', state: this.getPublicState() });
    this.broadcast({ type: 'PLAYER_JOINED', playerId, playerName });
  }

  removePlayer(playerId: string) {
    this.players.delete(playerId);
    this.broadcast({ type: 'PLAYER_LEFT', playerId });
    if (this.players.size === 0) {
      if (this.energyInterval) { clearInterval(this.energyInterval); this.energyInterval = null; }
      if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    }
  }

  handleMessage(playerId: string, msg: { type: string; [k: string]: unknown }) {
    const player = this.players.get(playerId);
    if (!player) return;

    switch (msg.type) {
      case 'SUBMIT_CHAIN': {
        if (playerId !== this.activePlayerId) {
          this.send(player.ws, { type: 'ERROR', message: 'Not your turn' });
          return;
        }
        // Phase guard: reject submissions during animations or after game over (#4)
        if (this.state.phase === 'FARKLE_ANIM' || this.state.phase === 'GAME_OVER') {
          return;
        }
        // 100ms input lock — reject rapid-fire submissions
        const lastAt = this.lastActionAt.get(playerId) ?? 0;
        if (Date.now() - lastAt < this.INPUT_LOCK_MS) {
          this.send(player.ws, { type: 'ERROR', message: 'Too fast' });
          return;
        }
        this.lastActionAt.set(playerId, Date.now());
        const chain = msg.chain as { row: number; col: number }[];
        if (!chain || chain.length < 2) {
          this.send(player.ws, { type: 'ERROR', message: 'Chain too short' });
          return;
        }
        // Bounds + duplicate validation — prevents score exploits (#5)
        const rows = this.state.grid.length;
        const cols = this.state.grid[0]?.length ?? 0;
        const seen = new Set<string>();
        for (const pos of chain) {
          if (pos.row < 0 || pos.row >= rows || pos.col < 0 || pos.col >= cols) {
            this.send(player.ws, { type: 'ERROR', message: 'Invalid chain position' });
            return;
          }
          const key = `${pos.row},${pos.col}`;
          if (seen.has(key)) {
            this.send(player.ws, { type: 'ERROR', message: 'Duplicate cell in chain' });
            return;
          }
          seen.add(key);
        }
        this.processChain(playerId, chain);
        break;
      }
      case 'BANK':
        this.handleBank(playerId);
        break;
      case 'PASS':
        this.nextTurn();
        break;
      case 'START_GAME':
        void this.handleStartGame(playerId);
        break;
      case 'PAY_ANTE': {
        // Validate the ante stage against the mode's schedule before accepting payment.
        const stage = msg.stage as string;
        const schedule = ANTE_SCHEDULES[this.gameMode as import('@match3d/farkle-shared').GameMode];
        const stageCfg = schedule?.stages.find(s => s.stage === stage);
        if (!stageCfg) {
          this.send(player.ws, { type: 'ERROR', message: `Unknown ante stage: ${stage}` });
          return;
        }
        const anteAmount = Math.round(this.settings.stakeAmount * stageCfg.amountMultiplier);
        const prev = this.antesPaidByPlayer.get(playerId) ?? 0;
        this.antesPaidByPlayer.set(playerId, prev + anteAmount);
        this.anteTotalCollected += anteAmount;
        // Wallet debit — fire-and-forget compliance write
        insertWalletTransaction({
          player_id: playerId,
          session_id: this.sessionId,
          type: this.settings.currencyMode === 'PDX' ? 'PDX_ANTE' : 'FD_ANTE',
          currency: this.settings.currencyMode,
          amount: -anteAmount,
          balance_after: 0, // caller must supply real balance; 0 = untracked in-game
          ante_stage: stage,
        });
        this.broadcast({ type: 'ANTE_PAID', playerId, stage, amount: anteAmount });
        break;
      }
      case 'DISRUPT': {
        const disruptType = msg.disruptType as string;
        const targetColumns = msg.targetColumns as number[];
        this.handleDisrupt(playerId, disruptType, targetColumns);
        break;
      }
      case 'INITIATE_HEIST':
        this.handleInitiateHeist(playerId);
        break;
      case 'BLOCK_HEIST':
        this.handleBlockHeist(playerId);
        break;
      case 'PICK_FACET': {
        const facetId = msg.facetId as FacetId;
        const cur = this.playerFacets.get(playerId);
        if (cur?.draftPending) {
          const next = _pickFacet(cur, facetId);
          this.playerFacets.set(playerId, next);
          this.broadcast({ type: 'FACET_PICKED', playerId, facetId, tier: next.tier });
        }
        break;
      }
      case 'SKIP_DRAFT': {
        const cur = this.playerFacets.get(playerId);
        if (cur?.draftPending) {
          this.playerFacets.set(playerId, skipFacetDraft(cur));
        }
        break;
      }
      case 'ACTIVATE_SHARD': {
        const cur = this.playerShards.get(playerId);
        const id = (msg.shardId as ShardId | undefined) ?? cur?.held;
        if (id && cur) {
          const next = activateShard(cur, id);
          this.playerShards.set(playerId, next);
          this.broadcast({ type: 'SHARD_ACTIVATED', playerId, shardId: id, expiresAt: next.expiresAt });
        }
        break;
      }
      case 'LEAVE_ROOM':
        this.removePlayer(playerId);
        break;
      case 'RALLY_VOTE': {
        const vote = msg.vote as 'bank' | 'pass' | 'continue';
        this.handleRallyVote(playerId, vote);
        break;
      }
      case 'NOTIFY_RALLY_DECISION': {
        const expiresAt = msg.expiresAt as number;
        if (this.rallyDecisionTimeout) clearTimeout(this.rallyDecisionTimeout);
        this.rallyVotes.clear();
        this.broadcast({ type: 'RALLY_DECISION_START', expiresAt });
        this.rallyDecisionTimeout = setTimeout(() => this._resolveRallyVotes(), 3000);
        break;
      }
    }
  }

  // ── H/A/I/G Genre state (per-player) ──────────────────────────────────────
  private playerRhythm: Map<string, RhythmState> = new Map();
  private playerFacets: Map<string, FacetState> = new Map();
  private playerShards: Map<string, RuleShardState> = new Map();
  private playerSlipstream: Map<string, SlipstreamState> = new Map();
  private turnCount = 0;  // recompute slipstream every 2 turns
  private _genreRng: () => number = seededRng(Date.now() ^ 0xfa4c1e);

  private rallyVotes: Map<string, 'bank' | 'pass' | 'continue'> = new Map();

  private handleRallyVote(playerId: string, vote: 'bank' | 'pass' | 'continue') {
    this.rallyVotes.set(playerId, vote);
    this.broadcast({ type: 'RALLY_VOTE_UPDATE', votes: Object.fromEntries(this.rallyVotes) });
    const playerIds = [...this.players.keys()].filter(id => this.players.get(id)?.ws.readyState === 1);
    if (this.rallyVotes.size >= playerIds.length) {
      this._resolveRallyVotes();
    }
  }

  private _resolveRallyVotes() {
    if (this.rallyDecisionTimeout) { clearTimeout(this.rallyDecisionTimeout); this.rallyDecisionTimeout = null; }
    const tally = { bank: 0, pass: 0, continue: 0 };
    for (const v of this.rallyVotes.values()) tally[v]++;
    this.rallyVotes.clear();
    // Tie-break priority: continue > pass > bank (bias toward keeping play going)
    let decision: 'bank' | 'pass' | 'continue';
    if (tally.continue >= tally.pass && tally.continue >= tally.bank) decision = 'continue';
    else if (tally.pass >= tally.bank) decision = 'pass';
    else decision = 'bank';
    this.broadcast({ type: 'RALLY_DECISION', decision });
    if (decision === 'bank') this.handleBank(this.activePlayerId ?? '');
    else if (decision === 'pass') this.nextTurn();
    else this.startTurnTimer(); // continue: keep current player, restart turn timer
  }

  // ── Heist Vault Cycle ────────────────────────────────────────────────────────
  // INITIATE_HEIST: any player may attempt a heist once vault ≥ VAULT_THRESHOLD.
  //   Server starts a HEIST_WINDOW_MS (5 s) block window and broadcasts
  //   HEIST_ATTEMPT so every client can show the countdown.
  //   If the window expires unblocked, _resolveHeist() credits vault to initiator.
  //
  // BLOCK_HEIST: any other player sends BLOCK_HEIST within the window.
  //   Server cancels the timer, broadcasts HEIST_BLOCKED, vault stays intact.
  //
  // RTP note: vault accumulates 70% of every bank (HEIST_CONSTANTS.VAULT_SPLIT).
  //   On a successful heist the vault amount is credited to the initiator's
  //   profile.banked and vaultTotal resets to 0. The house margin is already
  //   expressed via netRTP in endSession — vault redistribution does not alter
  //   the session-level RTP calculation.

  private handleInitiateHeist(playerId: string) {
    const isHeist = this.gameMode === 'HEIST_FREE' || this.gameMode === 'HEIST_CASINO';
    if (!isHeist) return;
    if (this.heistInitiatorId !== null) return;                         // already in progress
    if (this.vaultTotal < HEIST_CONSTANTS.VAULT_THRESHOLD) return;     // vault not full enough
    if (this.state.phase === 'GAME_OVER') return;

    const expiresAt = Date.now() + HEIST_CONSTANTS.HEIST_WINDOW_MS;
    this.heistInitiatorId = playerId;
    this.heistExpiresAt = expiresAt;

    this.broadcast({ type: 'HEIST_ATTEMPT', initiatorId: playerId, expiresAt, vaultAmount: this.vaultTotal });

    this.heistTimer = setTimeout(() => {
      this._resolveHeist();
    }, HEIST_CONSTANTS.HEIST_WINDOW_MS);
  }

  private handleBlockHeist(playerId: string) {
    if (!this.heistInitiatorId || playerId === this.heistInitiatorId) return;
    if (this.heistTimer) { clearTimeout(this.heistTimer); this.heistTimer = null; }
    const vaultAmount = this.vaultTotal;
    this.heistInitiatorId = null;
    this.heistExpiresAt = null;
    this.broadcast({ type: 'HEIST_BLOCKED', blockerId: playerId, vaultAmount });
  }

  private _resolveHeist() {
    const initiatorId = this.heistInitiatorId;
    if (!initiatorId) return;
    if (this.heistTimer) { clearTimeout(this.heistTimer); this.heistTimer = null; }

    const vaultAmount = this.vaultTotal;
    this.vaultTotal = 0;
    this.heistInitiatorId = null;
    this.heistExpiresAt = null;

    // Credit vault to initiator's banked score
    const initiator = this.players.get(initiatorId);
    if (initiator) {
      initiator.profile.banked += vaultAmount;
      this.state.banked += vaultAmount;
    }

    this.broadcast({ type: 'HEIST_SUCCESS', initiatorId, vaultAmount });
    this.broadcast({ type: 'ROOM_STATE', state: this.getPublicState() });

    // Check win condition after vault claim
    const playerBanked = initiator?.profile.banked ?? 0;
    if (playerBanked >= this.settings.levelWinScore) {
      void this.endSession(initiatorId);
    }
  }

  // ── processChain ─────────────────────────────────────────────────────────────
  // Called for every SUBMIT_CHAIN after bounds/duplicate validation in handleMessage.
  //
  // SCORING PIPELINE ORDER (all Sacred Core — do not reorder):
  //   1. Extract faces from grid cells at given positions
  //   2. scoreFarkle(faces) — Sacred Core Farkle scoring (farkleScorer.ts)
  //   3. resolveComboBreaker — absorb farkle with token if available (pipeline.ts)
  //   4. On real farkle: reset streak, broadcast FARKLE_ANIM, nextTurn after 800ms
  //   5. On score:
  //      a. applyEventHorizon(rawScore, streak, ladderMult) → MAX(eventHorizon, ladder)
  //      b. multiplierStep advances on 6-chain; resets on <6
  //      c. Auto-bank on chain<6: earn token if gain≥500, increment streak
  //      d. Heist vault split: 70% of gain tracked separately
  //      e. Win condition check: profile.banked ≥ levelWinScore → endSession
  //   6. Broadcast CHAIN_RESULT + BOARD_UPDATE + ROOM_STATE to all players
  //
  // ANALYTICS: Every chain (farkle or not) writes a chain_decision row via
  //   insertChainDecision(). was_optimal=false for farkles; computed for scoring chains.
  //   These rows are the skill-dependency audit trail.
  private processChain(playerId: string, chain: { row: number; col: number }[]) {
    // Step 1: Extract face values from grid at the submitted positions
    const faces = chain.map(pos => this.state.grid[pos.row]?.[pos.col]?.face).filter(Boolean);
    // Step 2: Sacred Core scoring — exhaustive Farkle rule lookup (farkleScorer.ts)
    const result = scoreFarkle(faces as import('@match3d/farkle-shared').DieFace[]);
    this.totalChains++;

    // Step 3: Combo Breaker check — if isFarkle=true AND token>0, absorb the farkle.
    // Token cost: 1. Turn continues with score=0, unbanked preserved.
    // Auditor note: COMBO_BREAKER_FIRED is broadcast so both players see the token spend.
    const cbTokens = this.playerTokens.get(playerId) ?? 0;
    const { isFarkle: effectiveFarkle, tokenConsumed } = resolveComboBreaker(result.isFarkle, cbTokens);
    if (tokenConsumed) {
      this.playerTokens.set(playerId, cbTokens - 1);
      this.broadcast({ type: 'COMBO_BREAKER_FIRED', playerId, tokensRemaining: cbTokens - 1 });
      this.broadcast({ type: 'CHAIN_RESULT', result: { ...result, isFarkle: false, score: 0 }, unbanked: this.state.unbanked, banked: this.state.banked });
      this.startTurnTimer();
      return;
    }

    // Step 4: Real farkle path — no token, no mercy.
    // streak resets; unbanked is lost to farklePool; phase set to FARKLE_ANIM for 800ms.
    // Auditor: was_optimal=false always on farkle (by definition it was the wrong choice).
    if (effectiveFarkle) {
      this.playerEventHorizonStreaks.set(playerId, 0);  // reset streak — score momentum broken
      const lost = this.state.unbanked;
      this.state = { ...this.state, farklePool: this.state.farklePool + lost, unbanked: 0, multiplierStep: 0, phase: 'FARKLE_ANIM' };
      this.broadcast({ type: 'CHAIN_RESULT', result, unbanked: 0, phase: 'FARKLE_ANIM' });
      // Compliance record: farkle decisions are evidence of variance (not skill),
      // but the count matters for the farkle_rate metric in skill reports.
      // Only written for casino sessions — free-mode farkles carry no regulatory weight.
      if (this.gameMode.endsWith('_CASINO')) {
        insertChainDecision({
          id: nanoid(), session_id: this.sessionId, player_id: playerId,
          chain_number: this.totalChains, faces_played: faces as number[],
          score_result: 0, multiplier_at: 1,
          unbanked_before: lost, decision: 'FARKLE', was_optimal: false,
          timestamp: new Date().toISOString(),
        });
      }
      setTimeout(() => { this.state = { ...this.state, phase: 'IDLE' }; this.nextTurn(); }, 800);
      return;
    }
    this.scoringChains++;

    // Step 5a: Apply post-score multipliers (pipeline.ts).
    // ladderMult = MULTIPLIER_LADDER[step] (1.0 → 4.0 over 0–5 consecutive 6-chains).
    // trickMult  = streak tier: COLD 1.0× / WARM 1.25× / HOT 1.5× / FRENZY 2.0×.
    // Final multiplier = MAX(ladderMult, trickMult) — NEVER a product, prevents runaway.
    const ladderMult = getMultiplier(this.state.multiplierStep);
    const eventHorizonStreak = this.playerEventHorizonStreaks.get(playerId) ?? 0;
    let scaled = applyEventHorizon(result.score, eventHorizonStreak, ladderMult);

    // ── L4 Genre wrappers (applied in fixed order, post-Event-Horizon) ────────
    // I: Facet modifier
    const facetState = this.playerFacets.get(playerId) ?? { ...INITIAL_FACET_STATE };
    const facetCtx: FacetContext = {
      banked: this.players.get(playerId)?.profile.banked ?? 0,
      isFrenzy: (this.players.get(playerId)?.energy ?? 0) >= 150,
      chainLength: chain.length,
      faces: faces as number[],
      consecutiveBanks: eventHorizonStreak,
    };
    scaled = applyFacetToScore(scaled, facetState, facetCtx);

    // G: Rule Shard (tick expiry first, then apply)
    const shardStatePre = this.playerShards.get(playerId) ?? { ...INITIAL_SHARD_STATE };
    const shardState = tickShard(shardStatePre);
    if (shardState !== shardStatePre) this.playerShards.set(playerId, shardState);
    const shardCtx: ShardContext = {
      isFrenzy: facetCtx.isFrenzy,
      consecutiveBanks: eventHorizonStreak,
      chainLength: chain.length,
    };
    scaled = applyActiveRuleShard(scaled, shardState, shardCtx);

    // H: Flow multiplier (Rhythm) — capped by slipstream
    const beatAcc = (msg as { beatAccuracy?: BeatAccuracy }).beatAccuracy ?? 'MISS';
    const rhythmState = this.playerRhythm.get(playerId) ?? { ...INITIAL_RHYTHM_STATE };
    const slipState = this.playerSlipstream.get(playerId);
    const flowCap = slipState?.flowCap ?? 2.0;
    const newRhythm = tickRhythmAccuracy(rhythmState, beatAcc, flowCap);
    this.playerRhythm.set(playerId, newRhythm);
    scaled = applyFlowMultiplier(scaled, newRhythm, flowCap);

    // Step 5b: Update unbanked + advance multiplierStep.
    // multiplierStep advances ONLY on full 6-chain; any shorter chain resets it to 0.
    // This creates the risk/reward pressure to commit 6-die chains.
    this.state = {
      ...this.state,
      unbanked: this.state.unbanked + scaled,
      multiplierStep: chain.length === 6 ? Math.min(this.state.multiplierStep + 1, 5) : 0,
    };

    // Compliance record: skill-dependency proof for this chain.
    // was_optimal flags whether the BANK/CONTINUE decision maximised expected value
    // given farkle risk and multiplier gain. Regulators use this to show skilled players
    // make better decisions and achieve higher final scores as a result.
    // Only written for casino sessions — free-mode decisions carry no regulatory weight.
    if (this.gameMode.endsWith('_CASINO')) {
      const farkleRisk = estimateFarkleRisk(
        faces.filter(f => f === 1).length,
        faces.filter(f => f === 5).length,
        faces.length,
      );
      const decision = chain.length < 6 ? 'BANK' : 'CONTINUE';
      insertChainDecision({
        id: nanoid(), session_id: this.sessionId, player_id: playerId,
        chain_number: this.totalChains, faces_played: faces as number[],
        score_result: result.score,
        multiplier_at: getMultiplier(this.state.multiplierStep),
        unbanked_before: this.state.unbanked, decision,
        was_optimal: isOptimalDecision(decision, this.state.unbanked, this.state.multiplierStep, farkleRisk),
        timestamp: new Date().toISOString(),
      });
    }

    if (chain.length < 6) {
      // Auto-bank: update both room total and per-player score (#1, #6)
      const gain = this.state.unbanked;
      const activePlayer = this.players.get(playerId);
      this.state.banked += gain;
      this.state.unbanked = 0;
      this.banksTaken++;
      this.bankCycleCount++;
      if (activePlayer) activePlayer.profile.banked += gain;
      // Rally cooperative pot — every bank contributes to shared pool
      const isRally = this.gameMode === 'RALLY_FREE' || this.gameMode === 'RALLY_CASINO';
      if (isRally) this.rallyPot += gain;
      // Vault split (display-only; heist-button deferred)
      const isHeist = this.gameMode === 'HEIST_FREE' || this.gameMode === 'HEIST_CASINO';
      if (isHeist) this.vaultTotal += Math.round(gain * HEIST_CONSTANTS.VAULT_SPLIT);
      // Trick meter streak + token earn
      const prevStreak = this.playerEventHorizonStreaks.get(playerId) ?? 0;
      this.playerEventHorizonStreaks.set(playerId, prevStreak + 1);
      if (gain >= EVENT_HORIZON_EARN_THRESHOLD) {
        const cur = this.playerTokens.get(playerId) ?? 0;
        if (cur < MAX_TOKENS) this.playerTokens.set(playerId, cur + 1);
      }
      // Gravity Flip — every 5 total banks, flip the board: rows reverse + faces invert (7-face)
      if (this.bankCycleCount % 5 === 0) {
        this.state.grid = applyGravityFlip(this.state.grid);
        this.broadcast({ type: 'GRAVITY_FLIP', bankCycle: this.bankCycleCount });
      }
      // G: Try to earn a Rule Shard on this bank
      const shardCur = this.playerShards.get(playerId) ?? { ...INITIAL_SHARD_STATE };
      const earnRng = this._genreRng() / 0xffffffff;
      const earnedShard = tryEarnShard(gain, earnRng, shardCur.held);
      if (earnedShard) {
        const withShard = { ...shardCur, held: earnedShard };
        this.playerShards.set(playerId, withShard);
        this.broadcast({ type: 'SHARD_EARNED', playerId, shardId: earnedShard });
      }

      // I: Tick facet round and start a new draft
      const facetCur = this.playerFacets.get(playerId) ?? { ...INITIAL_FACET_STATE };
      const facetAfterTick = tickFacetRound(facetCur, false);
      const draftSeed = this._genreRng();
      const facetWithDraft = startFacetDraft(facetAfterTick, draftSeed);
      this.playerFacets.set(playerId, facetWithDraft);
      this.send(
        this.players.get(playerId)!.ws,
        { type: 'DRAFT_START', options: facetWithDraft.draftOptions, tier: facetWithDraft.tier, roundsActive: facetWithDraft.roundsActive },
      );

      const playerBanked = activePlayer?.profile.banked ?? this.state.banked;
      this.checkMilestones(playerId, playerBanked);
      if (playerBanked >= this.settings.levelWinScore) {
        void this.endSession(playerId);
        return;
      }
    }

    this.broadcast({ type: 'CHAIN_RESULT', result, unbanked: this.state.unbanked, banked: this.state.banked });
    this.broadcast({ type: 'BOARD_UPDATE', grid: this.state.grid });
    this.broadcast({ type: 'ROOM_STATE', state: this.getPublicState() });
    this.startTurnTimer();
  }

  setGameMode(mode: string) {
    this.gameMode = mode;
  }

  private async handleStartGame(_fromPlayerId: string) {
    // LOW #12: non-solo modes require at least 2 players
    const isSolo = this.gameMode === 'SOLO_FREE' || this.gameMode === 'SOLO_CASINO';
    if (!isSolo && this.players.size < 2) return;

    this.roleMap = this.assignRoles();
    const roles: Record<string, string | null> = {};
    for (const [pid] of this.players) {
      roles[pid] = this.roleMap.get(pid) ?? null;
      this.playerTokens.set(pid, 1);
      this.playerEventHorizonStreaks.set(pid, 0);
      this.playerRhythm.set(pid, { ...INITIAL_RHYTHM_STATE });
      this.playerFacets.set(pid, { ...INITIAL_FACET_STATE });
      this.playerShards.set(pid, { ...INITIAL_SHARD_STATE });
    }
    // Seed the genre RNG from the committed hash (deterministic per session)
    const hashPrefix = parseInt(this.csprng.getSeed().slice(0, 8), 36) || Date.now();
    this._genreRng = seededRng(hashPrefix);
    this._recomputeSlipstream();

    // FAIRNESS: broadcast commitment hash BEFORE GAME_STARTED so clients capture it.
    // Players retain committedHash and compare against serverSeed revealed at SESSION_END.
    const hash = await this.committedHash;
    this.broadcast({ type: 'FAIRNESS_COMMITMENT', committedHash: hash });

    this.broadcast({ type: 'GAME_STARTED', gameMode: this.gameMode, roles });
    this.startEnergyTick(); // MEDIUM #8: start energy on game start, not construction
    this.startTurnTimer();  // CRITICAL #2: start turn timer on game start, not addPlayer
  }

  private assignRoles(): Map<string, string> {
    const map = new Map<string, string>();
    const ids = [...this.players.keys()];
    const RALLY_ROLES = ['RAINMAKER', 'HEADHUNTER', 'ARCHIVIST', 'CONDUCTOR'];
    const HEIST_ROLES = ['RAINMAKER', 'HEADHUNTER'];

    if (this.gameMode === 'RALLY_FREE' || this.gameMode === 'RALLY_CASINO') {
      ids.forEach((id, i) => map.set(id, RALLY_ROLES[i % RALLY_ROLES.length]!));
    } else if (this.gameMode === 'HEIST_FREE' || this.gameMode === 'HEIST_CASINO') {
      ids.forEach((id, i) => map.set(id, HEIST_ROLES[i % HEIST_ROLES.length]!));
    }
    return map;
  }

  private handleDisrupt(fromPlayerId: string, disruptType: string, targetColumns: number[]) {
    const VALID_TYPES = new Set(['ice_send', 'lock_send', 'scramble']);
    if (!VALID_TYPES.has(disruptType)) return;
    const disruption = {
      id: `${Date.now()}-${fromPlayerId}`,
      type: disruptType,
      fromPlayerId,
      targetColumns: (targetColumns ?? []).filter((c: number) => c >= 0 && c <= 6),
      receivedAt: Date.now(),
    };
    for (const [pid, player] of this.players) {
      if (pid !== fromPlayerId) {
        this.send(player.ws, { type: 'DISRUPTION_INCOMING', disruption });
      }
    }
  }

  private handleBank(playerId: string) {
    // HIGH #3: only the active player may bank
    if (playerId !== this.activePlayerId) return;

    const activePlayer = this.players.get(playerId);
    if (this.state.unbanked > 0) {
      const gain = this.state.unbanked;
      this.state.banked += gain;
      this.state.unbanked = 0;
      this.banksTaken++;
      this.bankCycleCount++;
      // Update per-player score (#1, #6)
      if (activePlayer) activePlayer.profile.banked += gain;
      const isRally = this.gameMode === 'RALLY_FREE' || this.gameMode === 'RALLY_CASINO';
      if (isRally) this.rallyPot += gain;
      const isHeist = this.gameMode === 'HEIST_FREE' || this.gameMode === 'HEIST_CASINO';
      if (isHeist) this.vaultTotal += Math.round(gain * HEIST_CONSTANTS.VAULT_SPLIT);
      const prevStreak = this.playerEventHorizonStreaks.get(playerId) ?? 0;
      this.playerEventHorizonStreaks.set(playerId, prevStreak + 1);
      if (gain >= EVENT_HORIZON_EARN_THRESHOLD) {
        const cur = this.playerTokens.get(playerId) ?? 0;
        if (cur < MAX_TOKENS) this.playerTokens.set(playerId, cur + 1);
      }
      // Gravity Flip — every 5 total banks
      if (this.bankCycleCount % 5 === 0) {
        this.state.grid = applyGravityFlip(this.state.grid);
        this.broadcast({ type: 'GRAVITY_FLIP', bankCycle: this.bankCycleCount });
      }
      // G: Shard earn on explicit bank
      const shardCurB = this.playerShards.get(playerId) ?? { ...INITIAL_SHARD_STATE };
      const earnRngB = this._genreRng() / 0xffffffff;
      const earnedShardB = tryEarnShard(gain, earnRngB, shardCurB.held);
      if (earnedShardB) {
        this.playerShards.set(playerId, { ...shardCurB, held: earnedShardB });
        this.broadcast({ type: 'SHARD_EARNED', playerId, shardId: earnedShardB });
      }
      // I: Facet draft trigger
      const facetCurB = this.playerFacets.get(playerId) ?? { ...INITIAL_FACET_STATE };
      const facetAfterTickB = tickFacetRound(facetCurB, false);
      const draftSeedB = this._genreRng();
      const facetWithDraftB = startFacetDraft(facetAfterTickB, draftSeedB);
      this.playerFacets.set(playerId, facetWithDraftB);
      const ws = this.players.get(playerId)?.ws;
      if (ws) this.send(ws, { type: 'DRAFT_START', options: facetWithDraftB.draftOptions, tier: facetWithDraftB.tier, roundsActive: facetWithDraftB.roundsActive });

      const playerBanked = activePlayer?.profile.banked ?? this.state.banked;
      this.checkMilestones(playerId, playerBanked);
      if (playerBanked >= this.settings.levelWinScore) {
        this.broadcast({ type: 'CHAIN_RESULT', banked: this.state.banked, unbanked: 0 });
        this.broadcast({ type: 'ROOM_STATE', state: this.getPublicState() });
        void this.endSession(playerId);
        return; // early exit — don't call nextTurn after session ends
      }
    }
    this.broadcast({ type: 'CHAIN_RESULT', banked: this.state.banked, unbanked: 0 });
    this.broadcast({ type: 'ROOM_STATE', state: this.getPublicState() });
    this.nextTurn();
  }

  private nextTurn() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    const ids = [...this.players.keys()];
    const idx = ids.indexOf(this.activePlayerId ?? '');
    this.activePlayerId = ids[(idx + 1) % ids.length] ?? null;
    this.turnCount++;
    // A: Recompute slipstream every 2 turns (spec: §6.3)
    if (this.turnCount % 2 === 0) this._recomputeSlipstream();
    this.broadcast({ type: 'TURN_CHANGE', activePlayerId: this.activePlayerId });
    this.startTurnTimer();
  }

  private _recomputeSlipstream() {
    const isVS    = this.gameMode === 'VS_FREE'    || this.gameMode === 'VS_CASINO';
    const isHeist = this.gameMode === 'HEIST_FREE' || this.gameMode === 'HEIST_CASINO';
    if (!isVS && !isHeist) return;
    // Rank players by profile.banked descending (highest = pos 1 = leader)
    const ranked = [...this.players.entries()]
      .sort((a, b) => b[1].profile.banked - a[1].profile.banked)
      .map(([id]) => id);
    const total = ranked.length;
    const slipMap: Record<string, SlipstreamState> = {};
    ranked.forEach((pid, i) => {
      const state = computeSlipstream(i + 1, total);
      this.playerSlipstream.set(pid, state);
      slipMap[pid] = state;
    });
    this.broadcast({ type: 'SLIPSTREAM_UPDATE', slipstream: slipMap });
  }

  // C13: Rally Casino milestone payouts
  private checkMilestones(playerId: string, banked: number) {
    if (this.gameMode !== 'RALLY_CASINO') return;
    if (!this.milestonesHit.has(playerId)) this.milestonesHit.set(playerId, new Set());
    const hit = this.milestonesHit.get(playerId)!;
    for (const m of RALLY_MILESTONES) {
      if (banked >= m.points && !hit.has(m.tier)) {
        hit.add(m.tier);
        const payout = Math.round(this.settings.stakeAmount * m.multiplier);
        this.broadcast({ type: 'MILESTONE_PAYOUT', playerId, tier: m.tier, points: m.points, payout });
      }
    }
  }

  // ── endSession ───────────────────────────────────────────────────────────────
  // CALLED WHEN: player's profile.banked ≥ levelWinScore (processChain / handleBank).
  // GUARD: sessionEnded flag prevents double-fire on concurrent bank events.
  //
  // FAIRNESS PROOF STEP (auditor read this):
  //   serverSeed is revealed here for the FIRST TIME.
  //   committedHash = SHA-256(serverSeed) was computed in the constructor and
  //   is already known to all clients (sent at room creation).
  //   Any client can verify: sha256(serverSeed) === committedHash.
  //   This proves the server did NOT change its seed after seeing player decisions.
  //
  // RTP PAYOUT FORMULAS (mode-specific):
  //   SOLO_CASINO:
  //     payout = (playerBanked / levelWinScore) × stakeAmount × targetRTP
  //     targetRTP = 0.92 (from rtpConfig.ts). Normalizer applied in monteCarlo.ts.
  //     Auditor: player must reach 100% of winScore to collect full 92% of stake.
  //   VS_CASINO:
  //     winner = highest profile.banked among all players
  //     payout = stakeAmount × playerCount × targetRTP (1.00 nominal, fee=0.08 → 0.92 net)
  //     Auditor: zero-sum; loser loses stake, winner wins (n-1) × stake × 0.92.
  //   RALLY_CASINO / HEIST_CASINO:
  //     Same formula as VS_CASINO (highest banked takes pot × targetRTP).
  //     Milestone payouts (RALLY_CASINO) are separate incremental events via checkMilestones().
  //   *_FREE:
  //     payout = 0. No real money. RTP irrelevant.
  //
  // ANALYTICS: insertSession writes a single row to session_analytics capturing
  //   chains, farkle count, banks taken, and final score for regulator queries.
  private async endSession(triggeringPlayerId: string) {
    if (this.sessionEnded) return;
    this.sessionEnded = true;
    this.state = { ...this.state, phase: 'GAME_OVER' }; // block further chain submissions (#4)
    if (this.turnTimer) clearTimeout(this.turnTimer);

    // FAIRNESS REVEAL: expose raw seed so clients can verify commitment
    const serverSeed = this.csprng.getSeed();
    const committedHash = await this.committedHash;

    const isCasino = this.gameMode.endsWith('_CASINO');
    // netRTP: actual player payout rate after house margin (platformFee removed — margin is
    // expressed as grossRTP - netRTP; see rtpConfig.ts audit header for full documentation).
    const cfg = RTP_CONFIGS[this.gameMode as keyof typeof RTP_CONFIGS];
    const netRTP = cfg?.netRTP ?? 0.92;
    const playerCount = this.players.size;

    // Per-player payout map — populated by mode-specific logic below
    const payouts = new Map<string, number>(); // playerId → payout amount
    let winnerId: string | null = null;
    const finalPot = this.settings.stakeAmount * playerCount + this.anteTotalCollected;

    if (this.gameMode === 'VS_CASINO') {
      // Zero-sum: highest profile.banked player wins the pot × netRTP.
      // No platformFee — margin is netRTP already encoding the house cut.
      const totalPot = this.settings.stakeAmount * playerCount + this.anteTotalCollected;
      let topScore = -1;
      for (const [pid, p] of this.players) {
        if (p.profile.banked > topScore) { topScore = p.profile.banked; winnerId = pid; }
      }
      if (winnerId) payouts.set(winnerId, Math.round(totalPot * netRTP));

    } else if (this.gameMode === 'SOLO_CASINO') {
      // Proportional: score-to-goal ratio × stake × netRTP
      const player = this.players.get(triggeringPlayerId);
      const banked = player?.profile.banked ?? this.state.banked;
      const stakeWithAnte = this.settings.stakeAmount + (this.antesPaidByPlayer.get(triggeringPlayerId) ?? 0);
      payouts.set(triggeringPlayerId, Math.round((banked / this.settings.levelWinScore) * stakeWithAnte * netRTP));
      winnerId = triggeringPlayerId;

    } else if (this.gameMode === 'RALLY_CASINO') {
      // COOPERATIVE: shared rallyPot is split EVENLY. No winner/loser.
      // Spec: "No player may steal, betray, or redirect the pot in Rally mode."
      const totalPot = this.settings.stakeAmount * playerCount + this.anteTotalCollected;
      const payoutPerPlayer = Math.round(totalPot * netRTP / playerCount);
      for (const [pid] of this.players) {
        payouts.set(pid, payoutPerPlayer);
      }

    } else if (this.gameMode === 'HEIST_CASINO') {
      // Vault-augmented: vault adds to pot; highest-scorer takes the combined pot × netRTP
      const totalPot = this.settings.stakeAmount * playerCount + this.anteTotalCollected;
      let topScore = -1;
      for (const [pid, p] of this.players) {
        if (p.profile.banked > topScore) { topScore = p.profile.banked; winnerId = pid; }
      }
      if (winnerId) payouts.set(winnerId, Math.round(totalPot * netRTP));
    }

    // Determine primary payout for SESSION_END broadcast (winner for VS/Heist; first player for Rally)
    const primaryPayout = winnerId ? (payouts.get(winnerId) ?? 0) : (payouts.values().next().value ?? 0);

    // Broadcast result: seed reveal included for client-side fairness verification.
    this.broadcast({
      type: 'SESSION_END',
      winnerId,
      payout: isCasino ? primaryPayout : 0,
      payouts: isCasino ? Object.fromEntries(payouts) : {},
      serverSeed,    // ← players verify sha256(this) === committedHash
      committedHash, // ← committed before first roll; proves seed was fixed
    });

    // Compliance analytics write — casino modes only
    const finalBanked = this.state.banked;
    const playerAnte = this.antesPaidByPlayer.get(triggeringPlayerId) ?? 0;
    const effectiveStake = this.settings.stakeAmount + playerAnte;
    const playerPayout = payouts.get(triggeringPlayerId) ?? 0;
    const rtpActual = effectiveStake > 0 ? playerPayout / effectiveStake : 0;

    void insertSession({
      id: this.sessionId,
      player_id: triggeringPlayerId,
      mode: this.gameMode,
      seed_hash: committedHash,
      started_at: this.sessionStartedAt,
      ended_at: new Date().toISOString(),
      total_chains: this.totalChains,
      scoring_chains: this.scoringChains,
      farkle_count: this.totalChains - this.scoringChains,
      banks_taken: this.banksTaken,
      peak_multiplier: getMultiplier(this.state.multiplierStep),
      final_banked: finalBanked,
      final_score: finalBanked,
      avg_chain_score: this.scoringChains > 0 ? finalBanked / this.scoringChains : 0,
      payout_amount: playerPayout,
      rtp_actual: rtpActual,
      ante_total: playerAnte,
      final_pot: finalPot,
      fee_removed_reason: isCasino ? 'VS_CASINO_PLATFORM_FEE_REMOVED_v2' : undefined,
    });

    // Wallet award transactions — fire-and-forget compliance writes
    if (isCasino && playerPayout > 0) {
      insertWalletTransaction({
        player_id: triggeringPlayerId,
        session_id: this.sessionId,
        type: this.settings.currencyMode === 'PDX' ? 'PDX_AWARD' : 'FD_AWARD',
        currency: this.settings.currencyMode,
        amount: playerPayout,
        balance_after: 0, // caller supplies real balance; 0 = in-game untracked
        notes: `${this.gameMode} session payout (netRTP=${netRTP})`,
      });
    }
    // For Rally, write awards to every player
    if (this.gameMode === 'RALLY_CASINO') {
      for (const [pid, amt] of payouts) {
        if (pid === triggeringPlayerId) continue; // already written above
        if (amt > 0) {
          insertWalletTransaction({
            player_id: pid,
            session_id: this.sessionId,
            type: this.settings.currencyMode === 'PDX' ? 'PDX_AWARD' : 'FD_AWARD',
            currency: this.settings.currencyMode,
            amount: amt,
            balance_after: 0,
            notes: `RALLY_CASINO cooperative split (netRTP=${netRTP})`,
          });
        }
      }
    }
  }

  private getPublicState() {
    return {
      roomId: this.id,
      grid: this.state.grid,
      phase: this.state.phase,
      banked: this.state.banked,
      unbanked: this.state.unbanked,
      multiplierStep: this.state.multiplierStep,
      activePlayerId: this.activePlayerId,
      vault: this.vaultTotal,
      players: [...this.players.values()].map(p => {
        const pid = p.profile.id;
        const shard = this.playerShards.get(pid) ?? INITIAL_SHARD_STATE;
        const facet = this.playerFacets.get(pid) ?? INITIAL_FACET_STATE;
        const rhythm = this.playerRhythm.get(pid) ?? INITIAL_RHYTHM_STATE;
        const slip = this.playerSlipstream.get(pid);
        return {
          ...p.profile,
          energy: p.energy,
          tokens: this.playerTokens.get(pid) ?? 0,
          eventHorizonStreak: this.playerEventHorizonStreaks.get(pid) ?? 0,
          // Genre state (H/A/I/G)
          flowMultiplier: rhythm.flowMultiplier,
          slipstreamPosition: slip?.position ?? null,
          slipstreamWindowFactor: slip?.windowFactor ?? null,
          facetId: facet.equipped,
          facetTier: facet.tier,
          shardHeld: shard.held,
          shardActive: shard.active,
          shardExpiresAt: shard.expiresAt,
        };
      }),
    };
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  async saveToDb() {
    const database = await getDb();
    database.run(
      'INSERT OR REPLACE INTO rooms (id, state, created_at) VALUES (?, ?, ?)',
      [this.id, JSON.stringify(this.getPublicState()), Date.now()]
    );
  }
}
