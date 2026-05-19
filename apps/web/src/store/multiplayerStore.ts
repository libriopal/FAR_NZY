// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import { create } from 'zustand';
import type { DisruptionEvent, RallyRole } from '@match3d/farkle-shared';
import type { FacetId, ShardId, SlipstreamState } from '@match3d/farkle-engine';

function resolveWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  // Derive from current page: https → wss, http → ws. Keeps local dev working and
  // prevents mixed-content blocks on production HTTPS deployments.
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.hostname;
  const port = window.location.hostname === 'localhost' ? ':3001' : '';
  return `${proto}://${host}${port}`;
}
const WS_URL = resolveWsUrl();

export interface MultiplayerPlayer {
  id: string;
  name: string;
  banked: number;
  isActive: boolean;
  isConnected: boolean;
  role?: RallyRole | null;
  tokens?: number;
  eventHorizonStreak?: number;
  // Genre state (H/A/I/G) — included in ROOM_STATE players array
  flowMultiplier?: number;
  slipstreamPosition?: number | null;
  slipstreamWindowFactor?: number | null;
  facetId?: FacetId | null;
  facetTier?: 1 | 2;
  shardHeld?: ShardId | null;
  shardActive?: ShardId | null;
  shardExpiresAt?: number | null;
}

export interface MultiplayerStoreState {
  status: 'idle' | 'connecting' | 'lobby' | 'playing' | 'disconnected';
  roomCode: string | null;
  playerId: string | null;
  players: MultiplayerPlayer[];
  activePlayerId: string | null;
  banked: number;
  unbanked: number;
  vault: number;
  lastMessage: { type: string; [k: string]: unknown } | null;
  lastDisruption: DisruptionEvent | null;
  myRole: RallyRole | null;
  error: string | null;
  fairnessCommitment: string | null;  // SHA-256 hash received before first roll; verify at SESSION_END
  gravityFlipPending: boolean;        // true during the cinematic board-flip animation
  heistActive: boolean;               // a heist block window is open
  heistInitiatorId: string | null;
  heistExpiresAt: number | null;
  // H/A/I/G — genre state for the local player
  myDraft: { options: FacetId[]; tier: 1 | 2; roundsActive: number } | null;
  myFacetId: FacetId | null;
  myFacetTier: 1 | 2;
  myShardHeld: ShardId | null;
  myShardActive: ShardId | null;
  myShardExpiresAt: number | null;
  mySlipstream: SlipstreamState | null;
  myFlowMultiplier: number;
}

const INITIAL: MultiplayerStoreState = {
  status: 'idle', roomCode: null, playerId: null,
  players: [], activePlayerId: null,
  banked: 0, unbanked: 0, vault: 0,
  lastMessage: null, lastDisruption: null,
  myRole: null, error: null,
  fairnessCommitment: null, gravityFlipPending: false,
  heistActive: false, heistInitiatorId: null, heistExpiresAt: null,
  myDraft: null, myFacetId: null, myFacetTier: 1,
  myShardHeld: null, myShardActive: null, myShardExpiresAt: null,
  mySlipstream: null, myFlowMultiplier: 1.0,
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
        const rs = msg.state as { players: MultiplayerPlayer[]; activePlayerId: string; banked: number; unbanked: number; vault?: number };
        const myPlayer = rs.players?.find(p => p.id === myId);
        return {
          ...next,
          players: rs.players ?? prev.players,
          activePlayerId: rs.activePlayerId,
          banked: rs.banked,
          unbanked: rs.unbanked,
          vault: rs.vault ?? prev.vault,
          gravityFlipPending: false,
          myFlowMultiplier: myPlayer?.flowMultiplier ?? prev.myFlowMultiplier,
          mySlipstream: myPlayer?.slipstreamPosition != null
            ? { position: myPlayer.slipstreamPosition!, totalPlayers: rs.players?.length ?? 1, windowFactor: myPlayer.slipstreamWindowFactor ?? 1.0, flowCap: 2.0 }
            : prev.mySlipstream,
          myFacetId: myPlayer?.facetId ?? prev.myFacetId,
          myFacetTier: myPlayer?.facetTier ?? prev.myFacetTier,
          myShardHeld: myPlayer?.shardHeld ?? prev.myShardHeld,
          myShardActive: myPlayer?.shardActive ?? prev.myShardActive,
          myShardExpiresAt: myPlayer?.shardExpiresAt ?? prev.myShardExpiresAt,
        };
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
      case 'FAIRNESS_COMMITMENT':
        return { ...next, fairnessCommitment: msg.committedHash as string };
      case 'GRAVITY_FLIP':
        return { ...next, gravityFlipPending: true };
      case 'HEIST_ATTEMPT':
        return { ...next, heistActive: true, heistInitiatorId: msg.initiatorId as string, heistExpiresAt: msg.expiresAt as number };
      case 'HEIST_BLOCKED':
      case 'HEIST_SUCCESS':
        return { ...next, heistActive: false, heistInitiatorId: null, heistExpiresAt: null };
      case 'DRAFT_START':
        return { ...next, myDraft: { options: msg.options as FacetId[], tier: msg.tier as 1 | 2, roundsActive: msg.roundsActive as number } };
      case 'FACET_PICKED':
        if (msg.playerId === myId) {
          return { ...next, myDraft: null, myFacetId: msg.facetId as FacetId, myFacetTier: msg.tier as 1 | 2 };
        }
        return { ...next, myDraft: null };
      case 'SHARD_EARNED':
        if (msg.playerId === myId) {
          return { ...next, myShardHeld: msg.shardId as ShardId };
        }
        return next;
      case 'SHARD_ACTIVATED':
        if (msg.playerId === myId) {
          return { ...next, myShardHeld: null, myShardActive: msg.shardId as ShardId, myShardExpiresAt: msg.expiresAt as number };
        }
        return next;
      case 'SLIPSTREAM_UPDATE': {
        if (!myId) return next;
        const slipMap = msg.slipstream as Record<string, SlipstreamState>;
        const mine = slipMap[myId] ?? null;
        return { ...next, mySlipstream: mine };
      }
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
  createRoom(playerName: string, gameMode?: string, levelWinScore?: number) {
    _connect(() => _send({ type: 'CREATE_ROOM', playerName, gameMode, levelWinScore }));
  },
  joinRoom(roomCode: string, playerName: string) {
    _connect(() => _send({ type: 'JOIN_ROOM', roomCode: roomCode.toUpperCase(), playerName }));
  },
  startGame() { _send({ type: 'START_GAME' }); },
  submitChain(chain: { row: number; col: number }[], beatAccuracy?: 'PERFECT' | 'GOOD' | 'MISS') {
    _send({ type: 'SUBMIT_CHAIN', chain, beatAccuracy: beatAccuracy ?? 'MISS' });
  },
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
  sendRallyVote(choice: 'bank' | 'pass' | 'continue') {
    _send({ type: 'RALLY_VOTE', vote: choice });
  },
  sendRallyDecisionStart(expiresAt: number) {
    _send({ type: 'NOTIFY_RALLY_DECISION', expiresAt });
  },
  payAnte(stage: string) {
    _send({ type: 'PAY_ANTE', stage });
  },
  initiateHeist() { _send({ type: 'INITIATE_HEIST' }); },
  blockHeist()    { _send({ type: 'BLOCK_HEIST' }); },
  pickFacet(facetId: string)  { _send({ type: 'PICK_FACET',  facetId }); },
  skipDraft()                 { _send({ type: 'SKIP_DRAFT' }); },
  activateShard(shardId: string) { _send({ type: 'ACTIVATE_SHARD', shardId }); },
};
