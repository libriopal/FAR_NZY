// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import { useMultiplayerStore, mpActions } from '../store/multiplayerStore.js';
import type { MultiplayerPlayer, MultiplayerStoreState } from '../store/multiplayerStore.js';
import type { DisruptionType } from '@match3d/farkle-shared';

export type { MultiplayerPlayer };
export type MultiplayerState = MultiplayerStoreState;

export function useMultiplayer() {
  const state = useMultiplayerStore();
  return {
    state,
    createRoom: (playerName: string, gameMode?: string) => mpActions.createRoom(playerName, gameMode),
    joinRoom: (roomCode: string, playerName: string) => mpActions.joinRoom(roomCode, playerName),
    startGame: () => mpActions.startGame(),
    submitChain: (chain: { row: number; col: number }[]) => mpActions.submitChain(chain),
    bank: () => mpActions.bank(),
    sendDisruption: (type: DisruptionType, cols: number[]) => mpActions.sendDisruption(type as string, cols),
    leaveRoom: () => mpActions.leaveRoom(),
    sendRallyVote: (choice: 'bank' | 'pass' | 'continue') => mpActions.sendRallyVote(choice),
    sendRallyDecisionStart: (expiresAt: number) => mpActions.sendRallyDecisionStart(expiresAt),
  };
}
