// SKELETON — not a complete regression suite. Fill in assertions per
// GAP-1b (ADR-023) before relying on this for sacred-file coverage.
//
// gameRoom.ts is CORE SACRED (core/.ff-core-lock). This file only reads
// and exercises GameRoom through its public API (addPlayer, handleMessage,
// setGameMode, isEmpty) — it does not modify the sacred file.

import { test } from 'node:test';
import assert from 'node:assert';
import type { WebSocket } from 'ws';
import type { LobbySettings } from '@match3d/farkle-shared';
import { scoreFarkle } from '@match3d/farkle-engine';
import { GameRoom } from './gameRoom.js';

function mockSocket(onSend?: (data: string) => void): WebSocket {
  return { readyState: 1, send: (data: string) => onSend?.(data) } as unknown as WebSocket;
}

const SOLO_SETTINGS: LobbySettings = {
  mode: 'SOLO_FREE',
  playerCount: 1,
  turnTimerSeconds: 15,
  blockerDensity: 'MEDIUM',
  threeOnesScore: 1000,
  singleOneScore: 100,
  rainbowRedReward: 0,
  currencyMode: 'FD',
  stakeAmount: 0,
  rainbowBlueReward: 0,
};

test('addPlayer sends ROOM_STATE to the joining player', () => {
  const room = new GameRoom(SOLO_SETTINGS);
  const sent: string[] = [];
  const ws = mockSocket((data) => sent.push(data));

  room.addPlayer(ws, 'p1', 'Player One');

  assert.ok(sent.length > 0);
  assert.match(sent[0], /ROOM_STATE/);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMessages(sent: string[]): any[] {
  return sent.map(s => JSON.parse(s));
}

test('SUBMIT_CHAIN scores from the server grid — a forged SUBMIT_CHAIN_FACES no longer exists (GAP-1b/ADR-024/ADR-025 closed)', () => {
  const room = new GameRoom(SOLO_SETTINGS);
  const sent: string[] = [];
  const ws = mockSocket((data) => sent.push(data));
  room.addPlayer(ws, 'p1', 'Player One');

  const roomState = parseMessages(sent).find(m => m.type === 'ROOM_STATE');
  assert.ok(roomState, 'expected ROOM_STATE broadcast on join');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grid: any[][] = roomState.state.grid;

  // Find a real adjacent pair of die-bearing cells that actually scores
  // (non-farkle) — the point of this test is that SUBMIT_CHAIN has no faces
  // field at all, so there is nothing for a forged client to assert; the
  // score must come from whatever the grid genuinely contains at (row,col).
  let chain: { row: number; col: number }[] | null = null;
  for (let r = 0; r < grid.length && !chain; r++) {
    for (let c = 0; c < grid[r].length - 1; c++) {
      const a = grid[r][c];
      const b = grid[r][c + 1];
      if (a.face === null || b.face === null) continue;
      if (!scoreFarkle([a.face, b.face]).isFarkle) {
        chain = [{ row: r, col: c }, { row: r, col: c + 1 }];
        break;
      }
    }
  }
  assert.ok(chain, 'expected at least one adjacent scoring pair on a freshly created grid');

  sent.length = 0;
  room.handleMessage('p1', { type: 'SUBMIT_CHAIN', chain: chain! });
  const chainResult = parseMessages(sent).find(m => m.type === 'CHAIN_RESULT');
  const boardUpdate = parseMessages(sent).find(m => m.type === 'BOARD_UPDATE');
  assert.ok(chainResult, 'expected a CHAIN_RESULT broadcast from a legitimate grid-backed chain');
  assert.ok(boardUpdate, 'expected a BOARD_UPDATE broadcast reflecting cell consumption + refill');
});

test('SUBMIT_CHAIN_FACES is no longer a recognized message type — a forged six-of-a-kind produces no score', () => {
  const room = new GameRoom(SOLO_SETTINGS);
  const sent: string[] = [];
  const ws = mockSocket((data) => sent.push(data));
  room.addPlayer(ws, 'p1', 'Player One');

  sent.length = 0;
  room.handleMessage('p1', {
    type: 'SUBMIT_CHAIN_FACES',
    faces: [1, 1, 1, 1, 1, 1],
    chainLength: 6,
    chainColumns: [0, 0, 0, 0, 0, 0],
  });
  const chainResult = parseMessages(sent).find(m => m.type === 'CHAIN_RESULT');
  assert.strictEqual(chainResult, undefined, 'the removed SUBMIT_CHAIN_FACES handler must not produce any CHAIN_RESULT');
});
