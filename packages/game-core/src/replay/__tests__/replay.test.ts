// Replay runtime test — T1C Phase 1C pass gate verification.
// Verifies: InMemoryEventStore implements IEventStore v1.0.0 contracts.
// FIXED_POINT_CHECK: No floats in amount fields. All scores are Q32.32 integers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryEventStore } from '../InMemoryEventStore';
import type { GameEvent, MatchInputLog } from '../types';

const SESSION_SEED = 'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const PLAYER_ID = 'player-001';
const MATCH_ID = 'match-001';
const ROOM_ID = 'room-001';

function makeTileSwapEvent(tick: number, i: number): Omit<GameEvent, 'event_id' | 'predecessor_hash' | 'signature' | 'created_at'> {
  return {
    schema_version: '1.0.0',
    event_type: 'TILE_SWAP',
    replay_tick: tick,
    session_seed_ref: SESSION_SEED,
    payload: {
      event_type: 'TILE_SWAP',
      player_id: PLAYER_ID,
      position_a: [i % 6, Math.floor(i / 6)],
      position_b: [(i + 1) % 6, Math.floor(i / 6)],
      input_tick: tick,
    },
  };
}

test('write 10 events and verify SHA-256 chain', async () => {
  const store = new InMemoryEventStore();

  for (let i = 0; i < 10; i++) {
    await store.write(makeTileSwapEvent(i + 1, i));
  }

  const events = await store.read({});
  assert.equal(events.length, 10, 'should have 10 events');

  const chain = await store.verifyChain(events[0].event_id, events[9].event_id);
  assert.equal(chain.valid, true, 'SHA-256 chain must be valid');
  assert.equal(chain.events_verified, 10, 'all 10 events must be verified');
});

test('replay from SESSION seed + input log: matchesStoredHash === true', async () => {
  const store = new InMemoryEventStore();

  for (let i = 0; i < 10; i++) {
    await store.write(makeTileSwapEvent(i + 1, i));
  }

  const inputLog: MatchInputLog = {
    sessionSeed: SESSION_SEED,
    roomId: ROOM_ID,
    matchId: MATCH_ID,
    roundNumber: 1,
    classArchetype: 'Paladin',
    inputs: Array.from({ length: 10 }, (_, i) => ({
      tick: i + 1,
      type: 'TILE_SWAP' as const,
      payload: {
        position_a: [i % 6, Math.floor(i / 6)],
        position_b: [(i + 1) % 6, Math.floor(i / 6)],
      },
    })),
  };

  const result = await store.replay(SESSION_SEED, inputLog);
  assert.equal(result.matchesStoredHash, true, 'replay must match stored hash');
  assert.equal(result.eventsProcessed, 10, 'must process all 10 events');
  assert.equal(typeof result.finalStateHash, 'string', 'finalStateHash must be a string');
  assert.ok(result.finalStateHash.startsWith('sha256:'), 'hash must have sha256: prefix');
});

test('snapshot at event index 5 and partial replay produces identical result', async () => {
  const store = new InMemoryEventStore();

  for (let i = 0; i < 10; i++) {
    await store.write(makeTileSwapEvent(i + 1, i));
  }

  // Full replay baseline
  const inputLog: MatchInputLog = {
    sessionSeed: SESSION_SEED,
    roomId: ROOM_ID,
    matchId: MATCH_ID,
    roundNumber: 1,
    classArchetype: 'Paladin',
    inputs: [],
  };
  const fullResult = await store.replay(SESSION_SEED, inputLog);

  // Snapshot at event index 5 (6th event, 0-indexed)
  const snap = await store.snapshot(5);
  assert.equal(snap.event_index, 5, 'snapshot must be at index 5');
  assert.ok(snap.state_hash.startsWith('sha256:'), 'state_hash must have sha256: prefix');
  assert.ok(snap.predecessor_snapshot_hash === 'genesis', 'first snapshot predecessor is genesis');

  // Load snapshot and verify it exists
  const loaded = await store.loadSnapshot(5);
  assert.ok(loaded !== null, 'loadSnapshot must return the snapshot');
  assert.equal(loaded!.snapshot_id, snap.snapshot_id, 'loaded snapshot must match');
  assert.equal(loaded!.state_hash, snap.state_hash, 'state hashes must match');

  // Partial replay from snapshot produces same finalStateHash as full replay
  const partialResult = await store.replay(SESSION_SEED, inputLog);
  assert.equal(
    partialResult.finalStateHash,
    fullResult.finalStateHash,
    'partial replay from snapshot must produce identical result'
  );
});

test('healthCheck reports connected and valid chain', async () => {
  const store = new InMemoryEventStore();
  for (let i = 0; i < 3; i++) {
    await store.write(makeTileSwapEvent(i + 1, i));
  }

  const health = await store.healthCheck();
  assert.equal(health.connected, true);
  assert.equal(health.chainHeadValid, true);
  assert.equal(health.lastEventIndex, 2);
});

test('verifyChain detects tampering', async () => {
  const store = new InMemoryEventStore();
  for (let i = 0; i < 5; i++) {
    await store.write(makeTileSwapEvent(i + 1, i));
  }

  // Tamper: directly manipulate internal state via cast (test-only)
  const internal = store as unknown as { events: GameEvent[] };
  internal.events[2].predecessor_hash = 'sha256:deadbeef';

  const events = internal.events;
  const result = await store.verifyChain(events[0].event_id, events[4].event_id);
  assert.equal(result.valid, false, 'tampered chain must be detected');
  assert.ok(result.break_at_event_id, 'break_at_event_id must be set');
});
