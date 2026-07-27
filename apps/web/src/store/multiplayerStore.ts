// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import { create } from 'zustand';
import type { Cell, DisruptionEvent, RallyRole } from '@match3d/farkle-shared';
import { useFarkleStore } from './farkleStore.js';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:3001';

export interface MultiplayerPlayer {
  id: string;
  name: string;
  banked: number;
  isActive: boolean;
  isConnected: boolean;
  role?: RallyRole | null;
}

export interface MultiplayerStoreState {
  status: 'idle' | 'connecting' | 'lobby' | 'playing' | 'disconnected';
  roomCode: string | null;
  playerId: string | null;
  players: MultiplayerPlayer[];
  activePlayerId: string | null;
  banked: number;
  unbanked: number;
  lastMessage: { type: string; [k: string]: unknown } | null;
  lastDisruption: DisruptionEvent | null;
  myRole: RallyRole | null;
  boardSeed: number | null;
  // ADR-024/ADR-025: the server's authoritative grid, from BOARD_UPDATE /
  // ROOM_STATE — previously received but discarded. The 2D renderer and
  // grid-native chain-drag both read this directly.
  grid: Cell[][] | null;
  error: string | null;
}

const INITIAL: MultiplayerStoreState = {
  status: 'idle', roomCode: null, playerId: null,
  players: [], activePlayerId: null,
  banked: 0, unbanked: 0,
  lastMessage: null, lastDisruption: null,
  myRole: null, boardSeed: null, grid: null, error: null,
};

export const useMultiplayerStore = create<MultiplayerStoreState>()(() => ({ ...INITIAL }));

// ── Module-level WS singleton ─────────────────────────────────────────────────

let _ws: WebSocket | null = null;

// ── Reconnect state ───────────────────────────────────────────────────────────
// Stores credentials needed to attempt JOIN_ROOM on unexpected disconnect.
// Cleared on intentional leaveRoom(). Never resets farkleStore on reconnect.
let _reconnectCreds: { roomCode: string; playerId: string; playerName: string } | null = null;
let _pendingPlayerName = '';   // captured at createRoom/joinRoom before WS opens
let _reconnectAttempts = 0;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _isReconnecting = false;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

function _applyMessage(msg: { type: string; [k: string]: unknown }) {
  const myId = useMultiplayerStore.getState().playerId;
  useMultiplayerStore.setState(prev => {
    const next = { ...prev, lastMessage: msg };
    switch (msg.type) {
      case 'ROOM_CREATED':
      case 'ROOM_JOINED': {
        const roomCode = msg.roomCode as string;
        const playerId = msg.playerId as string;
        _reconnectCreds = { roomCode, playerId, playerName: _pendingPlayerName };
        if (_isReconnecting) {
          // Reconnect acknowledged — preserve 'playing'; ROOM_STATE will sync scores
          return { ...next, roomCode, playerId };
        }
        return { ...next, status: 'lobby' as const, roomCode, playerId };
      }
      case 'ROOM_STATE': {
        const rs = msg.state as { players: MultiplayerPlayer[]; activePlayerId: string; banked: number; unbanked: number; boardSeed?: number; grid?: Cell[][] };
        const boardSeed = rs.boardSeed ?? prev.boardSeed;
        const grid = rs.grid ?? prev.grid;
        if (_isReconnecting) {
          _isReconnecting = false;
          _reconnectAttempts = 0;
          if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
          const curStep = useFarkleStore.getState().multiplierStep;
          useFarkleStore.getState().syncFromServer(curStep, rs.banked, rs.unbanked);
          return { ...next, status: 'playing' as const, players: rs.players ?? prev.players, activePlayerId: rs.activePlayerId, banked: rs.banked, unbanked: rs.unbanked, boardSeed, grid };
        }
        return { ...next, players: rs.players ?? prev.players, activePlayerId: rs.activePlayerId, banked: rs.banked, unbanked: rs.unbanked, boardSeed, grid };
      }
      case 'GAME_STARTED': {
        const roleMap = ((msg.roles ?? {}) as Record<string, RallyRole>);
        const myRole = myId ? (roleMap[myId] ?? null) : null;
        const boardSeed = (msg.boardSeed as number | undefined) ?? prev.boardSeed;
        return { ...next, status: 'playing' as const, myRole, boardSeed };
      }
      case 'CHAIN_RESULT': {
        const multiplierStep = (msg.multiplierStep as number | undefined) ?? 0;
        const banked = (msg.banked as number) ?? prev.banked;
        const unbanked = (msg.unbanked as number | undefined) ?? prev.unbanked;
        const vaultPts = msg.vaultPts as number | undefined;
        const orbBonus = msg.orbBonus as number | undefined;
        const doublerBonus = msg.doublerBonus as number | undefined;
        const archivistBonus = msg.archivistBonus as number | undefined;
        // P2.6: server applies all bonuses (orb, doubler, ARCHIVIST, heist vault).
        // Always sync banked/unbanked — server total is now authoritative including bonuses.
        useFarkleStore.getState().syncFromServer(multiplierStep, banked, unbanked, vaultPts, orbBonus, doublerBonus, archivistBonus);
        return { ...next, banked, unbanked };
      }
      case 'DOUBLER_SPAWNED': {
        const col = msg.column as number;
        const expiresAt = msg.expiresAt as number;
        const duration = Math.max(0, expiresAt - Date.now());
        useFarkleStore.getState().spawnDoublerCell(col, duration);
        return next;
      }
      case 'ORB_COLLECTED':
        // Server confirmed orb collection — lastMessage set; no additional state change needed.
        return next;
      case 'TURN_CHANGE':
        return { ...next, activePlayerId: msg.activePlayerId as string };
      case 'DISRUPTION_INCOMING':
        return { ...next, lastDisruption: msg.disruption as DisruptionEvent };
      case 'BOARD_UPDATE':
        // ADR-024/ADR-025: now the regular vehicle for streaming grid state
        // (chain consumption + refill, dead-board recovery, entity taps) —
        // previously discarded except as a dead-board recovery signal.
        return { ...next, grid: (msg.grid as Cell[][] | undefined) ?? prev.grid };
      case 'ERROR':
        if (_isReconnecting) {
          _isReconnecting = false;
          _reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // stop retrying
        }
        return { ...next, error: msg.message as string };
      default:
        return next;
    }
  });
}

function _send(msg: object) {
  if (_ws?.readyState === WebSocket.OPEN) _ws.send(JSON.stringify(msg));
}

function _connect(onOpen: () => void) {
  if (_ws) { _ws.close(); _ws = null; }
  useMultiplayerStore.setState({ status: 'connecting', error: null });
  const ws = new WebSocket(WS_URL);
  _ws = ws;
  ws.onopen = onOpen;
  ws.onmessage = (ev) => {
    try { _applyMessage(JSON.parse(ev.data as string) as { type: string; [k: string]: unknown }); }
    catch { /* ignore malformed */ }
  };
  ws.onerror = () => useMultiplayerStore.setState({ error: 'Connection error', status: 'disconnected' });
  ws.onclose = () => {
    const status = useMultiplayerStore.getState().status;
    if (status === 'playing' && _reconnectCreds && _reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      _reconnectAttempts++;
      _isReconnecting = true;
      useMultiplayerStore.setState(s => ({ ...s, status: 'connecting' }));
      const creds = _reconnectCreds;
      _reconnectTimer = setTimeout(() => {
        _connect(() => _send({ type: 'JOIN_ROOM', roomCode: creds!.roomCode, playerId: creds!.playerId, playerName: creds!.playerName }));
      }, RECONNECT_DELAY_MS);
    } else {
      _reconnectAttempts = 0;
      _isReconnecting = false;
      _reconnectCreds = null;
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
      useMultiplayerStore.setState(s => s.status !== 'idle' ? { ...s, status: 'disconnected' } : s);
    }
  };
}

export const mpActions = {
  createRoom(playerName: string, gameMode?: string) {
    _pendingPlayerName = playerName;
    _reconnectCreds = null;
    _reconnectAttempts = 0;
    _connect(() => _send({ type: 'CREATE_ROOM', playerName, gameMode }));
  },
  joinRoom(roomCode: string, playerName: string) {
    _pendingPlayerName = playerName;
    _reconnectCreds = null;
    _reconnectAttempts = 0;
    _connect(() => _send({ type: 'JOIN_ROOM', roomCode: roomCode.toUpperCase(), playerName }));
  },
  startGame() { _send({ type: 'START_GAME' }); },
  submitChain(chain: { row: number; col: number }[]) { _send({ type: 'SUBMIT_CHAIN', chain }); },
  bank() { _send({ type: 'BANK' }); },
  sendDisruption(disruptType: string, targetColumns: number[]) {
    _send({ type: 'DISRUPT', disruptType, targetColumns });
  },
  // submitChainFaces removed (GAP-1b/ADR-024/ADR-025) — the server no longer
  // accepts client-asserted face values. Use submitChain (row/col) above.
  collectOrb(row: number, col: number) {
    _send({ type: 'COLLECT_ORB', row, col });
  },
  anchorGhost(row: number, col: number) {
    _send({ type: 'ANCHOR_GHOST', row, col });
  },
  tapSphere(row: number, col: number) {
    _send({ type: 'TAP_SPHERE', row, col });
  },
  detonateBomb(row: number, col: number, targetFace?: number) {
    _send({ type: 'DETONATE_BOMB', row, col, targetFace });
  },
  detonateRainbowBomb(row: number, col: number, targetFace?: number) {
    _send({ type: 'DETONATE_RAINBOW_BOMB', row, col, targetFace });
  },
  claimVault() {
    _send({ type: 'CLAIM_VAULT' });
  },
  leaveRoom() {
    _reconnectCreds = null;
    _reconnectAttempts = 0;
    _isReconnecting = false;
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
    _send({ type: 'LEAVE_ROOM' });
    _ws?.close();
    _ws = null;
    useMultiplayerStore.setState({ ...INITIAL });
  },
  sendRallyVote(choice: 'bank' | 'pass' | 'continue') {
    _send({ type: 'RALLY_VOTE', vote: choice });
  },
  sendRallyDecisionStart(expiresAt: number) {
    _send({ type: 'NOTIFY_RALLY_DECISION', expiresAt });
  },
};
