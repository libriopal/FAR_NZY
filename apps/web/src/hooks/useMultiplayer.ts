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
    // submitChainFaces removed (GAP-1b/ADR-024/ADR-025) — use submitChain above.
    collectOrb: (row: number, col: number) => mpActions.collectOrb(row, col),
    anchorGhost: (row: number, col: number) => mpActions.anchorGhost(row, col),
    tapSphere: (row: number, col: number) => mpActions.tapSphere(row, col),
    detonateBomb: (row: number, col: number, targetFace?: number) => mpActions.detonateBomb(row, col, targetFace),
    detonateRainbowBomb: (row: number, col: number, targetFace?: number) => mpActions.detonateRainbowBomb(row, col, targetFace),
    claimVault: () => mpActions.claimVault(),
  };
}
