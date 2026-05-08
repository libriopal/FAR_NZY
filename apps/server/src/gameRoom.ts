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
import { GAME_CONSTANTS } from '@match3d/farkle-shared';
import { CSPRNG, createGrid, SixPoolManager, scoreFarkle } from '@match3d/farkle-engine';
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
        const chain = msg.chain as { row: number; col: number }[];
        if (!chain || chain.length < 2) {
          this.send(player.ws, { type: 'ERROR', message: 'Chain too short' });
          return;
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
    }
  }

  private processChain(playerId: string, chain: { row: number; col: number }[]) {
    const faces = chain.map(pos => this.state.grid[pos.row][pos.col].face).filter(Boolean);
    const result = scoreFarkle(faces as import('@match3d/farkle-shared').DieFace[]);

    if (result.isFarkle) {
      const lost = this.state.unbanked;
      this.state = { ...this.state, farklePool: this.state.farklePool + lost, unbanked: 0, multiplierStep: 0, phase: 'FARKLE_ANIM' };
      this.broadcast({ type: 'CHAIN_RESULT', result, unbanked: 0, phase: 'FARKLE_ANIM' });
      setTimeout(() => { this.state.phase = 'IDLE'; this.nextTurn(); }, 800);
      return;
    }

    const scaled = Math.round(result.score * [1, 1.25, 1.5, 2, 3, 4][Math.min(this.state.multiplierStep, 5)]);
    this.state = {
      ...this.state,
      unbanked: this.state.unbanked + scaled,
      multiplierStep: chain.length === 6 ? Math.min(this.state.multiplierStep + 1, 5) : 0,
    };

    if (chain.length < 6) {
      this.state.banked += this.state.unbanked;
      this.state.unbanked = 0;
    }

    this.broadcast({ type: 'CHAIN_RESULT', result, unbanked: this.state.unbanked, banked: this.state.banked });
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
    this.broadcast({ type: 'GAME_STARTED', gameMode: this.gameMode, roles });
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
    void playerId;
    if (this.state.unbanked > 0) {
      this.state.banked += this.state.unbanked;
      this.state.unbanked = 0;
    }
    this.broadcast({ type: 'CHAIN_RESULT', banked: this.state.banked, unbanked: 0 });
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
