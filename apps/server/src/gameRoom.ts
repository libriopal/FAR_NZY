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
    this.energyInterval = setInterval(() => {
      for (const [id, p] of this.players.entries()) {
        p.energy = Math.max(0, p.energy - 1);
        if (p.energy === 0) {
          this.broadcast({ type: 'ENERGY_ZERO', playerId: id });
        }
      }
    }, 1000);
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
