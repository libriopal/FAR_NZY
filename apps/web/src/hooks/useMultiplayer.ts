import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisruptionType, DisruptionEvent } from '@match3d/farkle-shared';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:3001';

export interface MultiplayerPlayer {
  id: string;
  name: string;
  banked: number;
  isActive: boolean;
  isConnected: boolean;
}

export interface MultiplayerState {
  status: 'idle' | 'connecting' | 'lobby' | 'playing' | 'disconnected';
  roomCode: string | null;
  playerId: string | null;
  players: MultiplayerPlayer[];
  activePlayerId: string | null;
  banked: number;
  unbanked: number;
  lastMessage: { type: string; [k: string]: unknown } | null;
  lastDisruption: DisruptionEvent | null;
  error: string | null;
}

const INITIAL: MultiplayerState = {
  status: 'idle',
  roomCode: null,
  playerId: null,
  players: [],
  activePlayerId: null,
  banked: 0,
  unbanked: 0,
  lastMessage: null,
  lastDisruption: null,
  error: null,
};

export function useMultiplayer() {
  const [state, setState] = useState<MultiplayerState>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);
  const playerNameRef = useRef('Player');

  const _send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const _connect = useCallback((onOpen: (ws: WebSocket) => void) => {
    if (wsRef.current) wsRef.current.close();
    setState(s => ({ ...s, status: 'connecting', error: null }));

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => onOpen(ws);

    ws.onmessage = (ev) => {
      let msg: { type: string; [k: string]: unknown };
      try { msg = JSON.parse(ev.data as string); }
      catch { return; }

      setState(prev => {
        const next = { ...prev, lastMessage: msg };
        switch (msg.type) {
          case 'ROOM_CREATED':
          case 'ROOM_JOINED':
            return { ...next, status: 'lobby', roomCode: msg.roomCode as string, playerId: msg.playerId as string };
          case 'ROOM_STATE': {
            const rs = msg.state as { players: MultiplayerPlayer[]; activePlayerId: string; banked: number; unbanked: number };
            return { ...next, players: rs.players, activePlayerId: rs.activePlayerId, banked: rs.banked, unbanked: rs.unbanked };
          }
          case 'PLAYER_JOINED':
          case 'PLAYER_LEFT':
            return next; // ROOM_STATE broadcast will follow
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
    };

    ws.onerror = () => setState(s => ({ ...s, error: 'Connection error', status: 'disconnected' }));
    ws.onclose = () => setState(s => ({ ...s, status: 'disconnected' }));
  }, []);

  const createRoom = useCallback((playerName: string) => {
    playerNameRef.current = playerName;
    _connect((ws) => {
      ws.send(JSON.stringify({ type: 'CREATE_ROOM', playerName }));
    });
  }, [_connect]);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    playerNameRef.current = playerName;
    _connect((ws) => {
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: roomCode.toUpperCase(), playerName }));
    });
  }, [_connect]);

  const submitChain = useCallback((chain: { row: number; col: number }[]) => {
    _send({ type: 'SUBMIT_CHAIN', chain });
  }, [_send]);

  const bank = useCallback(() => _send({ type: 'BANK' }), [_send]);

  const sendDisruption = useCallback((disruptType: DisruptionType, targetColumns: number[]) => {
    _send({ type: 'DISRUPT', disruptType, targetColumns });
  }, [_send]);

  const leaveRoom = useCallback(() => {
    _send({ type: 'LEAVE_ROOM' });
    wsRef.current?.close();
    setState(INITIAL);
  }, [_send]);

  useEffect(() => () => wsRef.current?.close(), []);

  return { state, createRoom, joinRoom, submitChain, bank, sendDisruption, leaveRoom };
}
