// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import { create } from 'zustand';
import type { DisruptionEvent, RallyRole } from '@match3d/farkle-shared';

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
  error: string | null;
}

const INITIAL: MultiplayerStoreState = {
  status: 'idle', roomCode: null, playerId: null,
  players: [], activePlayerId: null,
  banked: 0, unbanked: 0,
  lastMessage: null, lastDisruption: null,
  myRole: null, error: null,
};

export const useMultiplayerStore = create<MultiplayerStoreState>()(() => ({ ...INITIAL }));

// ── Module-level WS singleton ─────────────────────────────────────────────────

let _ws: WebSocket | null = null;

function _applyMessage(msg: { type: string; [k: string]: unknown }) {
  const myId = useMultiplayerStore.getState().playerId;
  useMultiplayerStore.setState(prev => {
    const next = { ...prev, lastMessage: msg };
    switch (msg.type) {
      case 'ROOM_CREATED':
      case 'ROOM_JOINED':
        return { ...next, status: 'lobby' as const, roomCode: msg.roomCode as string, playerId: msg.playerId as string };
      case 'ROOM_STATE': {
        const rs = msg.state as { players: MultiplayerPlayer[]; activePlayerId: string; banked: number; unbanked: number };
        return { ...next, players: rs.players ?? prev.players, activePlayerId: rs.activePlayerId, banked: rs.banked, unbanked: rs.unbanked };
      }
      case 'GAME_STARTED': {
        const roleMap = ((msg.roles ?? {}) as Record<string, RallyRole>);
        const myRole = myId ? (roleMap[myId] ?? null) : null;
        return { ...next, status: 'playing' as const, myRole };
      }
      case 'CHAIN_RESULT':
        return { ...next, banked: (msg.banked as number) ?? prev.banked, unbanked: (msg.unbanked as number) ?? prev.unbanked };
      case 'TURN_CHANGE':
        return { ...next, activePlayerId: msg.activePlayerId as string };
      case 'DISRUPTION_INCOMING':
        return { ...next, lastDisruption: msg.disruption as DisruptionEvent };
      case 'ERROR':
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
    useMultiplayerStore.setState(s => s.status !== 'idle' ? { ...s, status: 'disconnected' } : s);
  };
}

export const mpActions = {
  createRoom(playerName: string, gameMode?: string) {
    _connect(() => _send({ type: 'CREATE_ROOM', playerName, gameMode }));
  },
  joinRoom(roomCode: string, playerName: string) {
    _connect(() => _send({ type: 'JOIN_ROOM', roomCode: roomCode.toUpperCase(), playerName }));
  },
  startGame() { _send({ type: 'START_GAME' }); },
  submitChain(chain: { row: number; col: number }[]) { _send({ type: 'SUBMIT_CHAIN', chain }); },
  bank() { _send({ type: 'BANK' }); },
  sendDisruption(disruptType: string, targetColumns: number[]) {
    _send({ type: 'DISRUPT', disruptType, targetColumns });
  },
  leaveRoom() {
    _send({ type: 'LEAVE_ROOM' });
    _ws?.close();
    _ws = null;
    useMultiplayerStore.setState({ ...INITIAL });
  },
};
