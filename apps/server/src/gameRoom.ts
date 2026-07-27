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
import { GAME_CONSTANTS, RALLY_MILESTONES, HEIST_CONSTANTS, CATALYST_WILD_BOOST, CATALYST_MAX_BOOST } from '@match3d/farkle-shared';
import { CSPRNG, createGrid, SixPoolManager, scoreFarkle, hashServerSeed, estimateFarkleRisk, isOptimalDecision, hasValidChain, resolveChainFaces, resolveChainAndAdvance, applyStandardBomb } from '@match3d/farkle-engine';
import { insertChainDecision, insertSession } from './analytics.js';
import { nanoid } from 'nanoid';

const WIN_SCORE = 100_000;

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
  orbActive: boolean;
  doublerColumns: { column: number; expiresAt: number }[];
  vaultPts: number;
  // ADR-025: percent boost to wild spawn odds from committed catalysts,
  // capped at CATALYST_MAX_BOOST. Passed to SixPoolManager.drawWild().
  catalystBoostPct: number;
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
  private explicitBanksTaken = 0;
  private readonly boardSeed: number;

  constructor(settings: LobbySettings) {
    this.id = nanoid(8).toUpperCase();
    this.settings = settings;
    this.csprng = new CSPRNG(nanoid(32));
    this.pool = new SixPoolManager(settings.playerCount, this.csprng);
    // Cosmetic-only seed for client physics rendering — independent of
    // this.csprng's fairness-committed gameplay stream. Safe to reveal
    // at game start since it never feeds scoring.
    this.boardSeed = Math.floor(Math.random() * 2 ** 31);
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
      orbActive: false,
      doublerColumns: [],
      vaultPts: 0,
      catalystBoostPct: 0,
    };
    this.committedHash = hashServerSeed(this.csprng.getSeed());
    this.startEnergyTick();
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

  private creditPlayerBanked(playerId: string, amount: number) {
    if (amount <= 0) return;
    const player = this.players.get(playerId);
    if (!player) return;
    player.profile.banked += amount;
  }

  private startTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => {
      this.handleBank(this.activePlayerId ?? '');
    }, (this.settings.turnTimerSeconds ?? 15) * 1000);
  }

  private startEnergyTick() {
    const FRENZY_THRESHOLD = 150;
    const MAX_ENERGY = 300;
    const TICK_MS = 200; // 200ms tick → ×5 per second = 5/sec rate
    this.energyInterval = setInterval(() => {
      for (const [id, p] of this.players.entries()) {
        const inFrenzy = p.energy >= FRENZY_THRESHOLD;
        // PRIME: +5/sec passive gain; FRENZY: -5/sec drain
        const delta = inFrenzy ? -1 : 1; // per 200ms tick = 5/sec
        p.energy = Math.max(0, Math.min(MAX_ENERGY, p.energy + delta));
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

    if (!this.activePlayerId) {
      this.activePlayerId = playerId;
      this.startTurnTimer();
    }

    this.send(ws, { type: 'ROOM_STATE', state: this.getPublicState() });
    this.broadcast({ type: 'PLAYER_JOINED', playerId, playerName });
  }

  removePlayer(playerId: string) {
    this.players.delete(playerId);
    this.broadcast({ type: 'PLAYER_LEFT', playerId });
    if (this.players.size === 0 && this.energyInterval) {
      clearInterval(this.energyInterval);
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
        if (chain.length > 6) {
          this.send(player.ws, { type: 'ERROR', message: 'Chain too long' });
          return;
        }
        // Validate 4-way adjacency: each consecutive pair must share exactly one edge;
        // no duplicate cells. Guards against non-adjacent face injection attacks.
        const seenCells = new Set<string>();
        let adjacencyOk = true;
        for (let i = 0; i < chain.length; i++) {
          const cell = chain[i]!;
          const key = `${cell.row},${cell.col}`;
          if (seenCells.has(key)) { adjacencyOk = false; break; }
          seenCells.add(key);
          if (i > 0) {
            const prev = chain[i - 1]!;
            const dist = Math.abs(prev.row - cell.row) + Math.abs(prev.col - cell.col);
            if (dist !== 1) { adjacencyOk = false; break; }
          }
        }
        if (!adjacencyOk) {
          this.send(player.ws, { type: 'ERROR', message: 'Invalid chain: non-adjacent tiles' });
          return;
        }
        this.processChain(playerId, chain);
        break;
      }
      // SUBMIT_CHAIN_FACES / processChainFaces() removed (GAP-1b / BUG-01,
      // docs/adr/ADR-024, ADR-025): client-asserted face values are never
      // trusted again. SUBMIT_CHAIN (above) — row/col positions validated
      // against this.state.grid — is now the only chain-submission path.
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
      case 'COLLECT_ORB': {
        // ADR-025: now row/col-addressed so the grid reflects the pickup —
        // previously only set a flag, never touched the grid (orb wasn't
        // grid-native before this pass).
        const row = msg.row as number;
        const col = msg.col as number;
        const cell = this.state.grid[row]?.[col];
        if (!cell || cell.type !== 'MULTIPLIER_ORB') {
          this.send(player.ws, { type: 'ERROR', message: 'Invalid orb position' });
          return;
        }
        const grid = this.state.grid.map(r => r.map(c => ({ ...c })));
        grid[row]![col] = { id: cell.id, face: null, type: 'NONE', state: 'EMPTY' };
        this.state = { ...this.state, grid, orbActive: true };
        this.broadcast({ type: 'ORB_COLLECTED', playerId });
        this.broadcast({ type: 'BOARD_UPDATE', grid: this.state.grid });
        break;
      }
      case 'ANCHOR_GHOST': {
        const row = msg.row as number;
        const col = msg.col as number;
        const cell = this.state.grid[row]?.[col];
        if (!cell || cell.state !== 'GHOST_PENDING') {
          this.send(player.ws, { type: 'ERROR', message: 'Invalid ghost position' });
          return;
        }
        const grid = this.state.grid.map(r => r.map(c => ({ ...c })));
        grid[row]![col] = { ...cell, state: 'NORMAL' };
        this.state = { ...this.state, grid };
        this.broadcast({ type: 'BOARD_UPDATE', grid: this.state.grid });
        break;
      }
      case 'TAP_SPHERE': {
        const row = msg.row as number;
        const col = msg.col as number;
        const cell = this.state.grid[row]?.[col];
        if (!cell || cell.type !== 'SPHERE') {
          this.send(player.ws, { type: 'ERROR', message: 'Invalid sphere position' });
          return;
        }
        const grid = this.state.grid.map(r => r.map(c => ({ ...c })));
        grid[row]![col] = { id: cell.id, face: null, type: 'NONE', state: 'EMPTY' };
        this.state = { ...this.state, grid };
        // +8 matches the client's current live behavior (useFarkleGame.ts's
        // tapEntity 'sphere' case) — not BOMB_CONSTANTS.SPHERE_ENERGY (20),
        // which is defined but was never actually wired to that path.
        const p = this.players.get(playerId);
        if (p) {
          p.energy = Math.max(0, Math.min(300, p.energy + 8));
          this.broadcast({ type: 'ENERGY_UPDATE', playerId, energy: p.energy });
        }
        this.broadcast({ type: 'BOARD_UPDATE', grid: this.state.grid });
        break;
      }
      case 'DETONATE_BOMB': {
        const row = msg.row as number;
        const col = msg.col as number;
        const cell = this.state.grid[row]?.[col];
        if (!cell || cell.type !== 'BOMB_STANDARD') {
          this.send(player.ws, { type: 'ERROR', message: 'Invalid bomb position' });
          return;
        }
        const isHeadhunter = this.roleMap.get(playerId) === 'HEADHUNTER';
        // applyStandardBomb (gridUtils.ts, sacred) already clears the bomb's
        // own cell and includes BOMB_CONSTANTS-equivalent self/blast points.
        const { grid, ptsEarned } = applyStandardBomb(this.state.grid, row, col, isHeadhunter);
        this.creditPlayerBanked(playerId, ptsEarned);
        this.state = { ...this.state, grid, banked: this.state.banked + ptsEarned };
        this.broadcast({ type: 'CHAIN_RESULT', isFarkle: false, banked: this.state.banked, unbanked: this.state.unbanked, multiplierStep: this.state.multiplierStep });
        this.broadcast({ type: 'BOARD_UPDATE', grid: this.state.grid });
        break;
      }
      case 'DETONATE_RAINBOW_BOMB': {
        // NOTE: applyRainbowBomb (gridUtils.ts, sacred) clears by DieColor,
        // but VoxelPhysicsSystem.activateRainbowBomb (the client's current,
        // live behavior) clears by FACE VALUE — a pre-existing mismatch
        // between the grid engine's design and the physics client's actual
        // mechanic. Matching live behavior (face-based) here for parity,
        // not the color-based sacred function; flagging the discrepancy
        // rather than silently picking one and calling it "the fix."
        const row = msg.row as number;
        const col = msg.col as number;
        const targetFace = typeof msg.targetFace === 'number' ? msg.targetFace : undefined;
        const cell = this.state.grid[row]?.[col];
        if (!cell || cell.type !== 'BOMB_RAINBOW') {
          this.send(player.ws, { type: 'ERROR', message: 'Invalid rainbow bomb position' });
          return;
        }
        const faceCounts: Record<number, number> = {};
        for (const gr of this.state.grid) {
          for (const gc of gr) {
            if (gc.face !== null && gc.state === 'NORMAL') faceCounts[gc.face] = (faceCounts[gc.face] ?? 0) + 1;
          }
        }
        let bestFace = targetFace;
        if (bestFace === undefined) {
          let bestCount = 0;
          for (const [f, c] of Object.entries(faceCounts)) {
            if (c > bestCount) { bestCount = c; bestFace = Number(f); }
          }
        }
        let ptsEarned = 0;
        const clearedGrid = this.state.grid.map(r => r.map(c => ({ ...c })));
        if (bestFace !== undefined) {
          for (let r = 0; r < clearedGrid.length; r++) {
            for (let c = 0; c < clearedGrid[r]!.length; c++) {
              const gc = clearedGrid[r]![c]!;
              if (gc.face === bestFace && gc.state === 'NORMAL') {
                if (gc.face === 1) ptsEarned += 100;
                else if (gc.face === 5) ptsEarned += 50;
                clearedGrid[r]![c] = { id: gc.id, face: null, type: 'NONE', state: 'EMPTY' };
              }
            }
          }
        }
        clearedGrid[row]![col] = { id: cell.id, face: null, type: 'NONE', state: 'EMPTY' };
        this.creditPlayerBanked(playerId, ptsEarned);
        this.state = { ...this.state, grid: clearedGrid, banked: this.state.banked + ptsEarned };
        this.broadcast({ type: 'CHAIN_RESULT', isFarkle: false, banked: this.state.banked, unbanked: this.state.unbanked, multiplierStep: this.state.multiplierStep });
        this.broadcast({ type: 'BOARD_UPDATE', grid: this.state.grid });
        break;
      }
      case 'CLAIM_VAULT': {
        if (this.state.vaultPts > 0) {
          this.creditPlayerBanked(playerId, this.state.vaultPts);
          this.state = {
            ...this.state,
            banked: this.state.banked + this.state.vaultPts,
            vaultPts: 0,
          };
          if (this.state.banked >= WIN_SCORE) {
            void this.endSession(playerId);
            return;
          }
          this.broadcast({ type: 'CHAIN_RESULT', isFarkle: false, banked: this.state.banked, unbanked: this.state.unbanked, multiplierStep: this.state.multiplierStep, vaultPts: 0 });
        }
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

  // Merged with the former processChainFaces() (GAP-1b/BUG-01, ADR-024,
  // ADR-025): faces now always come from resolveChainFaces() against
  // this.state.grid — never from client assertion — and this single method
  // carries the full bonus logic (heist/orb/doubler/archivist/catalyst) that
  // used to exist only on the unvalidated SUBMIT_CHAIN_FACES path.
  private processChain(playerId: string, chain: { row: number; col: number }[]) {
    const faces = resolveChainFaces(this.state.grid, chain);
    const chainLength = chain.length;
    const result = scoreFarkle(faces);
    this.totalChains++;

    if (result.isFarkle) {
      const lost = this.state.unbanked;
      this.state = { ...this.state, farklePool: this.state.farklePool + lost, unbanked: 0, multiplierStep: 0, orbActive: false, phase: 'FARKLE_ANIM' };
      this.broadcast({ type: 'CHAIN_RESULT', result, isFarkle: true, banked: this.state.banked, unbanked: 0, multiplierStep: 0, vaultPts: this.state.vaultPts, phase: 'FARKLE_ANIM', orbBonus: 0, doublerBonus: 0, archivistBonus: 0 });
      insertChainDecision({
        id: nanoid(), session_id: this.sessionId, player_id: playerId,
        chain_number: this.totalChains, faces_played: faces as number[],
        score_result: 0, multiplier_at: 1,
        unbanked_before: lost, decision: 'FARKLE', was_optimal: false,
        timestamp: new Date().toISOString(),
      });
      setTimeout(() => { this.state.phase = 'IDLE'; this.nextTurn(); }, 800);
      this._checkAndRecoverDeadBoard();
      return;
    }
    this.scoringChains++;

    const scaled = Math.round(result.score * ([1, 1.25, 1.5, 2, 3, 4][Math.min(this.state.multiplierStep, 5)] ?? 1));
    const newMultiplierStep = chainLength === 6 ? Math.min(this.state.multiplierStep + 1, 5) : 0;

    // ── Heist vault split (before banking — applies to scaled score) ──────────
    const isHeist = this.gameMode === 'HEIST_FREE' || this.gameMode === 'HEIST_CASINO';
    let toVault = 0;
    let scoreToUnbanked = scaled;
    if (isHeist && scaled > 0) {
      toVault = Math.round(scaled * HEIST_CONSTANTS.VAULT_SPLIT);
      scoreToUnbanked = scaled - toVault;
    }

    this.state = {
      ...this.state,
      unbanked: this.state.unbanked + scoreToUnbanked,
      vaultPts: this.state.vaultPts + toVault,
      multiplierStep: newMultiplierStep,
    };

    // ── Banking for chain < 6 ─────────────────────────────────────────────────
    if (chainLength < 6) {
      this.creditPlayerBanked(playerId, this.state.unbanked);
      this.state.banked += this.state.unbanked;
      this.state.unbanked = 0;
      this.banksTaken++;
      this.checkMilestones(playerId, this.state.banked);
      if (this.state.banked >= WIN_SCORE) {
        void this.endSession(playerId);
        return;
      }
    }

    // ── Multiplier orb ×1.5 (applied after banking; 0 for chain<6 since unbanked=0) ──
    let orbBonus = 0;
    if (this.state.orbActive && this.state.unbanked > 0) {
      orbBonus = Math.round(this.state.unbanked * 0.5);
      this.creditPlayerBanked(playerId, orbBonus);
      this.state = { ...this.state, banked: this.state.banked + orbBonus, orbActive: false };
    } else {
      this.state = { ...this.state, orbActive: false };
    }

    // ── Doubler cell ×2 — chainColumns now derived from the grid-validated
    // chain itself (chain.map(c => c.col)), never client-supplied ──────────────
    let doublerBonus = 0;
    const now = Date.now();
    this.state = { ...this.state, doublerColumns: this.state.doublerColumns.filter(d => d.expiresAt > now) };
    const colSet = new Set(chain.map(c => c.col));
    const activeDoubler = this.state.doublerColumns.find(d => colSet.has(d.column));
    if (activeDoubler) {
      doublerBonus = scaled + orbBonus;
      if (chainLength < 6) {
        this.creditPlayerBanked(playerId, doublerBonus);
      }
      this.state = {
        ...this.state,
        banked: this.state.banked + (chainLength < 6 ? doublerBonus : 0),
        unbanked: this.state.unbanked + (chainLength === 6 ? doublerBonus : 0),
        doublerColumns: this.state.doublerColumns.filter(d => d.column !== activeDoubler.column),
      };
    }

    // ── ARCHIVIST: recover 15% of farkle pool ────────────────────────────────
    let archivistBonus = 0;
    if (this.roleMap.get(playerId) === 'ARCHIVIST' && this.state.farklePool > 0) {
      archivistBonus = Math.round(this.state.farklePool * GAME_CONSTANTS.ARCHIVIST_PCT);
      this.state = {
        ...this.state,
        farklePool: this.state.farklePool - archivistBonus,
        unbanked: this.state.unbanked + archivistBonus,
      };
    }

    // ── CATALYST (ADR-025): scored chain including a catalyst cell bumps
    // wild spawn odds for subsequent refills, capped at CATALYST_MAX_BOOST ──
    const chainHasCatalyst = chain.some(pos => this.state.grid[pos.row]?.[pos.col]?.type === 'CATALYST');
    if (chainHasCatalyst) {
      this.state = {
        ...this.state,
        catalystBoostPct: Math.min(this.state.catalystBoostPct + CATALYST_WILD_BOOST, CATALYST_MAX_BOOST),
      };
    }

    const farkleRisk = estimateFarkleRisk(
      faces.filter(f => f === 1).length,
      faces.filter(f => f === 5).length,
      faces.length,
    );
    const decision = chainLength < 6 ? 'BANK' : 'CONTINUE';
    insertChainDecision({
      id: nanoid(), session_id: this.sessionId, player_id: playerId,
      chain_number: this.totalChains, faces_played: faces as number[],
      score_result: result.score,
      multiplier_at: [1, 1.25, 1.5, 2, 3, 4][Math.min(this.state.multiplierStep, 5)] ?? 1,
      unbanked_before: this.state.unbanked, decision,
      was_optimal: isOptimalDecision(decision, this.state.unbanked, this.state.multiplierStep, farkleRisk),
      timestamp: new Date().toISOString(),
    });

    // ── Consume the scored chain's cells, settle gravity, refill top row ──────
    this.state.grid = resolveChainAndAdvance(this.state.grid, this.pool, chain, this.state.catalystBoostPct);

    this.broadcast({ type: 'CHAIN_RESULT', result, isFarkle: false, banked: this.state.banked, unbanked: this.state.unbanked, multiplierStep: this.state.multiplierStep, vaultPts: this.state.vaultPts, orbBonus, doublerBonus, archivistBonus });
    this.broadcast({ type: 'BOARD_UPDATE', grid: this.state.grid });
    this.startTurnTimer();
  }

  setGameMode(mode: string) {
    this.gameMode = mode;
  }

  private handleStartGame(_fromPlayerId: string) {
    this.roleMap = this.assignRoles();
    const roles: Record<string, string | null> = {};
    for (const [pid] of this.players) {
      roles[pid] = this.roleMap.get(pid) ?? null;
    }
    this.broadcast({ type: 'GAME_STARTED', gameMode: this.gameMode, roles, boardSeed: this.boardSeed });
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
    // Route disruption to all opponents
    for (const [pid, player] of this.players) {
      if (pid !== fromPlayerId) {
        this.send(player.ws, { type: 'DISRUPTION_INCOMING', disruption });
      }
    }
  }

  private handleBank(playerId: string) {
    if (this.state.unbanked > 0) {
      this.creditPlayerBanked(playerId, this.state.unbanked);
      this.state.banked += this.state.unbanked;
      this.state.unbanked = 0;
      this.checkMilestones(playerId, this.state.banked);
    }
    // Every 3rd explicit bank: server spawns a CSPRNG-seeded doubler cell
    this.explicitBanksTaken++;
    if (this.explicitBanksTaken % 3 === 0) {
      const col = (this.pool.drawDie() + this.explicitBanksTaken * 2) % 7;
      const expiresAt = Date.now() + 30_000;
      this.state = { ...this.state, doublerColumns: [...this.state.doublerColumns, { column: col, expiresAt }] };
      this.broadcast({ type: 'DOUBLER_SPAWNED', column: col, expiresAt });
    }
    this.broadcast({ type: 'CHAIN_RESULT', isFarkle: false, banked: this.state.banked, unbanked: 0, multiplierStep: 0, vaultPts: this.state.vaultPts });
    if (this.state.banked >= WIN_SCORE) {
      void this.endSession(playerId);
      return;
    }
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
    if (this.turnTimer) clearTimeout(this.turnTimer);

    const serverSeed = this.csprng.getSeed();
    const committedHash = await this.committedHash;

    const isCasino = this.gameMode.endsWith('_CASINO');
    let payout = 0;
    let winnerId: string | null = null;

    if (this.gameMode === 'VS_CASINO') {
      // C14: highest-banked player wins totalPot × 0.92
      const totalPot = this.settings.stakeAmount * this.players.size;
      let topScore = -1;
      for (const [pid, p] of this.players) {
        if (p.profile.banked > topScore) { topScore = p.profile.banked; winnerId = pid; }
      }
      payout = Math.round(totalPot * 0.92);
    } else if (this.gameMode === 'SOLO_CASINO') {
      // C6: payout = (banked / WIN_SCORE) × stakeAmount × targetRTP(0.92)
      const player = this.players.get(triggeringPlayerId);
      const banked = player?.profile.banked ?? this.state.banked;
      payout = Math.round((banked / WIN_SCORE) * this.settings.stakeAmount * 0.92);
      winnerId = triggeringPlayerId;
    }

    this.broadcast({
      type: 'SESSION_END',
      winnerId,
      payout: isCasino ? payout : 0,
      serverSeed,
      committedHash,
    });

    // Analytics: insert session record (fire-and-forget)
    const finalBanked = this.players.get(triggeringPlayerId)?.profile.banked ?? this.state.banked;
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
      peak_multiplier: [1, 1.25, 1.5, 2, 3, 4][Math.min(this.state.multiplierStep, 5)] ?? 1,
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
      players: [...this.players.values()].map(p => ({ ...p.profile, energy: p.energy })),
      boardSeed: this.boardSeed,
    };
  }

  private _checkAndRecoverDeadBoard(attempt = 0): void {
    if (hasValidChain(this.state.grid)) return;
    if (attempt >= 3) {
      this.broadcast({ type: 'BOARD_DEAD_RECOVERY_FAILED' });
      void this.endSession(this.activePlayerId ?? '');
      return;
    }
    this.pool.reshuffle();
    this.state.grid = this._reshuffleGridFaces(this.state.grid);
    this.broadcast({ type: 'BOARD_UPDATE', grid: this.state.grid, recoveryAttempt: attempt + 1 });
    this._checkAndRecoverDeadBoard(attempt + 1);
  }

  private _reshuffleGridFaces(grid: import('@match3d/farkle-shared').Cell[][]): import('@match3d/farkle-shared').Cell[][] {
    const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
    for (let r = 0; r < newGrid.length; r++) {
      for (let c = 0; c < (newGrid[0]?.length ?? 0); c++) {
        const cell = newGrid[r]?.[c];
        if (!cell) continue;
        // Preserve blockers and structural states unchanged
        if (cell.type === 'STONE' || cell.state === 'EMPTY') continue;
        if (cell.state === 'FROZEN' || cell.state === 'LOCKED') continue;
        // Redraw face from pool for normal die/wild cells
        const d = this.pool.drawDie();
        const face = (d >= 1 && d <= 6 ? d : 1) as import('@match3d/farkle-shared').DieFace;
        newGrid[r]![c] = { ...cell, face };
      }
    }
    return newGrid;
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
