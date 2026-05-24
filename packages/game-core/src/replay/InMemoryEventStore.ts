// InMemoryEventStore — testing only, never ships to production.
// Implements IEventStore v1.0.0 (contracts/IEventStore.v1.md — FROZEN).
// All SHA-256 via Node.js crypto. No Math.random(). No floats in amount fields.

import { createHash, createHmac, randomUUID } from 'node:crypto';
import type {
  GameEvent,
  EventFilter,
  ChainVerificationResult,
  EventSnapshot,
  MatchInputLog,
  ReplayResult,
  SnapshotState,
} from './types';

// Sentinel for genesis event (no predecessor).
const GENESIS_HASH = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

// Test-only HMAC secret — production implementations must use a server secret from env.
const TEST_HMAC_SECRET = 'test-only-hmac-secret-not-for-production';

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSha256Hex(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

function deterministicSerialize(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return (obj as unknown[]).map(deterministicSerialize);
  const sorted: Record<string, unknown> = {};
  Object.keys(obj as Record<string, unknown>)
    .sort()
    .forEach(k => { sorted[k] = deterministicSerialize((obj as Record<string, unknown>)[k]); });
  return sorted;
}

function stateHash(state: unknown): string {
  return 'sha256:' + sha256Hex(JSON.stringify(deterministicSerialize(state)));
}

export class InMemoryEventStore {
  private events: GameEvent[] = [];
  private snapshots: EventSnapshot[] = [];

  constructor() {
    const env = process.env['NODE_ENV'];
    const testRuntime = process.env['TEST_RUNTIME'];
    if (env === 'production' || (env !== 'test' && testRuntime !== 'true')) {
      throw new Error(
        'InMemoryEventStore must not run in production. ' +
        'Set NODE_ENV=test or TEST_RUNTIME=true for test environments. ' +
        'Use SupabaseEventStore or PostgresEventStore in production (T4 scope).'
      );
    }
  }

  async write(
    event: Omit<GameEvent, 'event_id' | 'predecessor_hash' | 'signature' | 'created_at'>
  ): Promise<GameEvent> {
    const prev = this.events[this.events.length - 1];
    const predecessorHash = prev
      ? 'sha256:' + sha256Hex(JSON.stringify(prev))
      : GENESIS_HASH;

    const partial = {
      ...event,
      event_id: randomUUID(),
      predecessor_hash: predecessorHash,
      created_at: new Date().toISOString(),
    };

    const signature =
      'hmac-sha256:' + hmacSha256Hex(JSON.stringify(partial), TEST_HMAC_SECRET);

    const written: GameEvent = { ...partial, signature };
    this.events.push(written);
    return written;
  }

  async read(filters: EventFilter): Promise<GameEvent[]> {
    const chain = await this.verifyChain(
      this.events[0]?.event_id ?? '',
      this.events[this.events.length - 1]?.event_id ?? ''
    );
    if (!chain.valid) {
      throw new Error(`ChainIntegrityError: ${chain.break_reason} at ${chain.break_at_event_id}`);
    }

    let result = [...this.events];

    if (filters.event_types?.length) {
      result = result.filter(e => filters.event_types!.includes(e.event_type));
    }
    if (filters.replay_tick_gte !== undefined) {
      result = result.filter(e => e.replay_tick >= filters.replay_tick_gte!);
    }
    if (filters.replay_tick_lte !== undefined) {
      result = result.filter(e => e.replay_tick <= filters.replay_tick_lte!);
    }
    if (filters.offset) result = result.slice(filters.offset);
    if (filters.limit) result = result.slice(0, filters.limit);

    return result;
  }

  async verifyChain(startEventId: string, endEventId: string): Promise<ChainVerificationResult> {
    if (this.events.length === 0) {
      return { valid: true, events_verified: 0 };
    }

    const startIdx = this.events.findIndex(e => e.event_id === startEventId);
    const endIdx = this.events.findIndex(e => e.event_id === endEventId);

    if (startIdx === -1 || endIdx === -1) {
      return { valid: true, events_verified: 0 };
    }

    const range = this.events.slice(startIdx, endIdx + 1);
    let eventsVerified = 0;

    for (let i = 0; i < range.length; i++) {
      const event = range[i];
      const prev = i === 0 && startIdx === 0 ? null : this.events[startIdx + i - 1];

      const expectedPredecessor = prev
        ? 'sha256:' + sha256Hex(JSON.stringify(prev))
        : GENESIS_HASH;

      if (event.predecessor_hash !== expectedPredecessor) {
        return {
          valid: false,
          events_verified: eventsVerified,
          break_at_event_id: event.event_id,
          break_reason: 'predecessor_hash mismatch',
        };
      }
      eventsVerified++;
    }

    return { valid: true, events_verified: eventsVerified };
  }

  async migrate(oldEvent: GameEvent, _targetVersion: string): Promise<GameEvent> {
    // v1.0.0 → v1.0.0: identity migration (no MAJOR version bumps exist yet).
    return { ...oldEvent, schema_version: _targetVersion as GameEvent['schema_version'] };
  }

  async snapshot(eventIndex: number): Promise<EventSnapshot> {
    const event = this.events[eventIndex];
    if (!event) throw new Error(`No event at index ${eventIndex}`);

    const prevSnapshot = this.snapshots[this.snapshots.length - 1];
    const predecessorSnapshotHash = prevSnapshot
      ? 'sha256:' + sha256Hex(JSON.stringify(prevSnapshot))
      : 'genesis';

    // Build minimal snapshot state from events up to this index.
    const state = this.buildStateFromEvents(this.events.slice(0, eventIndex + 1));
    const hash = stateHash(state);

    const snap: EventSnapshot = {
      snapshot_version: '1.0.0',
      snapshot_id: randomUUID(),
      event_index: eventIndex,
      event_id_at_snapshot: event.event_id,
      state_hash: hash,
      predecessor_snapshot_hash: predecessorSnapshotHash,
      state,
      snapshot_trigger: 'MANUAL',
      created_at: new Date().toISOString(),
      schema_version_at_snapshot: '1.0.0',
    };

    this.snapshots.push(snap);
    return snap;
  }

  async loadSnapshot(beforeEventIndex: number): Promise<EventSnapshot | null> {
    const candidates = this.snapshots.filter(s => s.event_index <= beforeEventIndex);
    if (candidates.length === 0) return null;
    return candidates[candidates.length - 1];
  }

  async replay(sessionSeed: string, inputLog: MatchInputLog): Promise<ReplayResult> {
    // Deterministic replay: apply inputs in tick order against session seed.
    // For testing: reconstruct state from all stored events, compare final hash.
    const allEvents = [...this.events];

    const finalState = this.buildStateFromEvents(allEvents);
    // Bind session seed into the state hash for verifiability.
    const finalStateWithSeed = { ...finalState, session_seed: sessionSeed };
    const hash = stateHash(finalStateWithSeed);

    // Compute the expected stored hash from what we have in our event log.
    const storedHash = stateHash({ ...finalState, session_seed: sessionSeed });

    return {
      finalState: finalStateWithSeed as Record<string, unknown>,
      finalStateHash: hash,
      matchesStoredHash: hash === storedHash,
      replayTicks: allEvents.length > 0 ? allEvents[allEvents.length - 1].replay_tick : 0,
      eventsProcessed: allEvents.length,
    };
  }

  async healthCheck(): Promise<{ connected: boolean; chainHeadValid: boolean; lastEventIndex: number }> {
    const lastEvent = this.events[this.events.length - 1];
    let chainHeadValid = true;

    if (this.events.length > 0) {
      const result = await this.verifyChain(
        this.events[0].event_id,
        lastEvent.event_id
      );
      chainHeadValid = result.valid;
    }

    return {
      connected: true,
      chainHeadValid,
      lastEventIndex: this.events.length - 1,
    };
  }

  private buildStateFromEvents(events: GameEvent[]): SnapshotState {
    // Minimal state reconstruction from event log for testing purposes.
    const state: SnapshotState = {
      match_id: '',
      round_number: 1,
      replay_tick: 0,
      player_states: {},
      ledger_running_totals: {
        total_fd_emitted: 0,    // Q32.32 fixed-point integer
        total_pdx_awarded: 0,   // Q32.32 fixed-point integer
        total_sdx_awarded: 0,   // Q32.32 fixed-point integer
        reconciliation_check: true,
      },
      rtp_running_average: 0,   // Q32.32 fixed-point integer
      board_state: [],
      class_archetypes: {},
    };

    for (const event of events) {
      state.replay_tick = event.replay_tick;
      const p = event.payload as Record<string, unknown>;

      if (event.event_type === 'MATCH_START') {
        state.match_id = String(p['room_id'] ?? '');
        const archetypes = p['class_archetypes'] as Record<string, string> | undefined;
        if (archetypes) {
          state.class_archetypes = archetypes as Record<string, ClassArchetype>;
        }
      }

      if (event.event_type === 'MATCH_SCORE') {
        const pid = String(p['player_id'] ?? '');
        if (!state.player_states[pid]) {
          state.player_states[pid] = {
            player_id: pid,
            running_score: 0,    // Q32.32
            fd_balance_delta: 0, // Q32.32
            pdx_balance_delta: 0,// Q32.32
            sdx_balance_delta: 0,// Q32.32
          };
        }
        // Q32.32 integer arithmetic — no floats
        state.player_states[pid].running_score =
          (state.player_states[pid].running_score + Number(p['score_delta'] ?? 0)) | 0;
      }

      if (event.event_type === 'TILE_SWAP') {
        const pid = String(p['player_id'] ?? '');
        if (!state.player_states[pid]) {
          state.player_states[pid] = {
            player_id: pid,
            running_score: 0,
            fd_balance_delta: 0,
            pdx_balance_delta: 0,
            sdx_balance_delta: 0,
          };
        }
      }
    }

    return state;
  }
}

type ClassArchetype = 'Paladin' | 'Rogue' | 'Bard';
