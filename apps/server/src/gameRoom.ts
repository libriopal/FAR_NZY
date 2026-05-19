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

import type { WebSocket } from 'ws';
import type { Cell, Player, GamePhase, LobbySettings } from '@match3d/farkle-shared';
import { GAME_CONSTANTS, RALLY_MILESTONES, ENERGY_CONSTANTS, getMultiplier, HEIST_CONSTANTS } from '@match3d/farkle-shared';
import { CSPRNG, createGrid, SixPoolManager, scoreFarkle, hashServerSeed, estimateFarkleRisk, isOptimalDecision, RTP_CONFIGS, applyTrickMeter, resolveComboBreaker, TRICK_EARN_THRESHOLD, MAX_TOKENS } from '@match3d/farkle-engine';
import { insertChainDecision, insertSession } from './analytics.js';
import { nanoid } from 'nanoid';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoomPlayer {
  ws: WebSocket;
  profile: Player;
  energy: number;
}

interface GameRoomState {
  grid: Cell[][];
  phase: GamePhase;
  unbanked: number;
  banked: number;
  multiplierStep: number;
  farklePool: number;
}

// ── DB ────────────────────────────────────────────────────────────────────────

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

export class GameRoom {
  readonly id: string;
  private players: Map<string, RoomPlayer> = new Map();
  private activePlayerId: string | null = null;
  private state: GameRoomState;
  private pool: SixPoolManager;
  private csprng: CSPRNG;
  private settings: LobbySettings;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private energyInterval: ReturnType<typeof setInterval> | null = null;
  private gameMode: string = 'VS_FREE';
  private roleMap: Map<string, string> = new Map();
  private committedHash: Promise<string>;
  private milestonesHit: Map<string, Set<number>> = new Map();
  private sessionEnded = false;
  private rallyDecisionTimeout: ReturnType<typeof setTimeout> | null = null;
  private sessionId = nanoid();
  private sessionStartedAt = new Date().toISOString();
  private totalChains = 0;
  private scoringChains = 0;
  private banksTaken = 0;
  private lastActionAt: Map<string, number> = new Map();
  private readonly INPUT_LOCK_MS = 100;
  private playerTokens: Map<string, number> = new Map();
  private playerTrickStreaks: Map<string, number> = new Map();
  private vaultTotal: number = 0;

  constructor(settings: LobbySettings) {
    this.id = nanoid(8).toUpperCase();
    this.settings = settings;
    this.csprng = new CSPRNG(nanoid(32));
    this.pool = new SixPoolManager(settings.playerCount, this.csprng);
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

  private startTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => {
      this.handleBank(this.activePlayerId ?? '');
    }, (this.settings.turnTimerSeconds ?? 15) * 1000);
  }

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
        this.handleStartGame(playerId);
        break;
      case 'DISRUPT': {
        const disruptType = msg.disruptType as string;
        const targetColumns = msg.targetColumns as number[];
        this.handleDisrupt(playerId, disruptType, targetColumns);
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

  private processChain(playerId: string, chain: { row: number; col: number }[]) {
    const faces = chain.map(pos => this.state.grid[pos.row]?.[pos.col]?.face).filter(Boolean);
    const result = scoreFarkle(faces as import('@match3d/farkle-shared').DieFace[]);
    this.totalChains++;

    const cbTokens = this.playerTokens.get(playerId) ?? 0;
    const { isFarkle: effectiveFarkle, tokenConsumed } = resolveComboBreaker(result.isFarkle, cbTokens);
    if (tokenConsumed) {
      this.playerTokens.set(playerId, cbTokens - 1);
      this.broadcast({ type: 'COMBO_BREAKER_FIRED', playerId, tokensRemaining: cbTokens - 1 });
      this.broadcast({ type: 'CHAIN_RESULT', result: { ...result, isFarkle: false, score: 0 }, unbanked: this.state.unbanked, banked: this.state.banked });
      this.startTurnTimer();
      return;
    }

    if (effectiveFarkle) {
      this.playerTrickStreaks.set(playerId, 0);
      const lost = this.state.unbanked;
      this.state = { ...this.state, farklePool: this.state.farklePool + lost, unbanked: 0, multiplierStep: 0, phase: 'FARKLE_ANIM' };
      this.broadcast({ type: 'CHAIN_RESULT', result, unbanked: 0, phase: 'FARKLE_ANIM' });
      insertChainDecision({
        id: nanoid(), session_id: this.sessionId, player_id: playerId,
        chain_number: this.totalChains, faces_played: faces as number[],
        score_result: 0, multiplier_at: 1,
        unbanked_before: lost, decision: 'FARKLE', was_optimal: false,
        timestamp: new Date().toISOString(),
      });
      setTimeout(() => { this.state = { ...this.state, phase: 'IDLE' }; this.nextTurn(); }, 800);
      return;
    }
    this.scoringChains++;

    const ladderMult = getMultiplier(this.state.multiplierStep);
    const trickStreak = this.playerTrickStreaks.get(playerId) ?? 0;
    const scaled = applyTrickMeter(result.score, trickStreak, ladderMult);
    this.state = {
      ...this.state,
      unbanked: this.state.unbanked + scaled,
      multiplierStep: chain.length === 6 ? Math.min(this.state.multiplierStep + 1, 5) : 0,
    };

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

    if (chain.length < 6) {
      // Auto-bank: update both room total and per-player score (#1, #6)
      const gain = this.state.unbanked;
      const activePlayer = this.players.get(playerId);
      this.state.banked += gain;
      this.state.unbanked = 0;
      this.banksTaken++;
      if (activePlayer) activePlayer.profile.banked += gain;
      // Vault split (display-only; heist-button deferred)
      const isHeist = this.gameMode === 'HEIST_FREE' || this.gameMode === 'HEIST_CASINO';
      if (isHeist) this.vaultTotal += Math.round(gain * HEIST_CONSTANTS.VAULT_SPLIT);
      // Trick meter streak + token earn
      const prevStreak = this.playerTrickStreaks.get(playerId) ?? 0;
      this.playerTrickStreaks.set(playerId, prevStreak + 1);
      if (gain >= TRICK_EARN_THRESHOLD) {
        const cur = this.playerTokens.get(playerId) ?? 0;
        if (cur < MAX_TOKENS) this.playerTokens.set(playerId, cur + 1);
      }
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

  private handleStartGame(_fromPlayerId: string) {
    // LOW #12: non-solo modes require at least 2 players
    const isSolo = this.gameMode === 'SOLO_FREE' || this.gameMode === 'SOLO_CASINO';
    if (!isSolo && this.players.size < 2) return;

    this.roleMap = this.assignRoles();
    const roles: Record<string, string | null> = {};
    for (const [pid] of this.players) {
      roles[pid] = this.roleMap.get(pid) ?? null;
      this.playerTokens.set(pid, 1);
      this.playerTrickStreaks.set(pid, 0);
    }
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
      // Update per-player score (#1, #6)
      if (activePlayer) activePlayer.profile.banked += gain;
      const isHeist = this.gameMode === 'HEIST_FREE' || this.gameMode === 'HEIST_CASINO';
      if (isHeist) this.vaultTotal += Math.round(gain * HEIST_CONSTANTS.VAULT_SPLIT);
      const prevStreak = this.playerTrickStreaks.get(playerId) ?? 0;
      this.playerTrickStreaks.set(playerId, prevStreak + 1);
      if (gain >= TRICK_EARN_THRESHOLD) {
        const cur = this.playerTokens.get(playerId) ?? 0;
        if (cur < MAX_TOKENS) this.playerTokens.set(playerId, cur + 1);
      }
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
    this.broadcast({ type: 'TURN_CHANGE', activePlayerId: this.activePlayerId });
    this.startTurnTimer();
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

  // C6 / C7 / C14: session end — seed reveal + mode-appropriate payout
  private async endSession(triggeringPlayerId: string) {
    if (this.sessionEnded) return;
    this.sessionEnded = true;
    this.state = { ...this.state, phase: 'GAME_OVER' }; // block further chain submissions (#4)
    if (this.turnTimer) clearTimeout(this.turnTimer);

    const serverSeed = this.csprng.getSeed();
    const committedHash = await this.committedHash;

    const isCasino = this.gameMode.endsWith('_CASINO');
    let payout = 0;
    let winnerId: string | null = null;

    const rtpFactor = RTP_CONFIGS[this.gameMode as keyof typeof RTP_CONFIGS]?.targetRTP ?? 0.92;

    if (this.gameMode === 'VS_CASINO') {
      // C14: highest-banked player wins totalPot × targetRTP
      // Uses profile.banked which is now correctly updated per-player (#1)
      const totalPot = this.settings.stakeAmount * this.players.size;
      let topScore = -1;
      for (const [pid, p] of this.players) {
        if (p.profile.banked > topScore) { topScore = p.profile.banked; winnerId = pid; }
      }
      payout = Math.round(totalPot * rtpFactor);
    } else if (this.gameMode === 'SOLO_CASINO') {
      // C6: payout = (banked / levelWinScore) × stakeAmount × targetRTP
      // profile.banked is now correctly updated (#1)
      const player = this.players.get(triggeringPlayerId);
      const banked = player?.profile.banked ?? this.state.banked;
      payout = Math.round((banked / this.settings.levelWinScore) * this.settings.stakeAmount * rtpFactor);
      winnerId = triggeringPlayerId;
    } else if (this.gameMode === 'RALLY_CASINO' || this.gameMode === 'HEIST_CASINO') {
      // MEDIUM #7: highest-scorer among connected players wins the pot
      const totalPot = this.settings.stakeAmount * this.players.size;
      let topScore = -1;
      for (const [pid, p] of this.players) {
        if (p.profile.banked > topScore) { topScore = p.profile.banked; winnerId = pid; }
      }
      payout = Math.round(totalPot * rtpFactor);
    }

    this.broadcast({
      type: 'SESSION_END',
      winnerId,
      payout: isCasino ? payout : 0,
      serverSeed,
      committedHash,
    });

    const finalBanked = this.state.banked;
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
    });
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
      players: [...this.players.values()].map(p => ({
        ...p.profile,
        energy: p.energy,
        tokens: this.playerTokens.get(p.profile.id) ?? 0,
        trickStreak: this.playerTrickStreaks.get(p.profile.id) ?? 0,
      })),
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
