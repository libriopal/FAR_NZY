// Local type mirror — source of truth is contracts/IEventStore.v1.md,
// contracts/ReplayEvent.v1.md, contracts/Snapshot.v1.md (FROZEN v1.0.0).
// Do not modify without updating the root contracts/ files first.

export type SchemaVersion = `${number}.${number}.${number}`;

export type EventType =
  | 'MATCH_START'
  | 'ROUND_START'
  | 'TILE_SWAP'
  | 'CASCADE_COMPLETE'
  | 'MATCH_SCORE'
  | 'PDX_AWARD'
  | 'FD_EMIT'
  | 'SDX_AWARD'
  | 'ROUND_END'
  | 'MATCH_END';

export type ClassArchetype = 'Paladin' | 'Rogue' | 'Bard';

export interface GameEvent {
  schema_version: SchemaVersion;
  event_id: string;
  event_type: EventType;
  replay_tick: number;
  predecessor_hash: string;
  signature: string;
  created_at: string;
  session_seed_ref?: string;
  payload: Record<string, unknown>;
}

export interface EventFilter {
  match_id?: string;
  player_id?: string;
  event_types?: EventType[];
  replay_tick_gte?: number;
  replay_tick_lte?: number;
  limit?: number;
  offset?: number;
}

export interface ChainVerificationResult {
  valid: boolean;
  events_verified: number;
  break_at_event_id?: string;
  break_reason?: string;
}

export type SnapshotTrigger =
  | 'INTERVAL_1000'
  | 'INTERVAL_60'
  | 'INTERVAL_5000'
  | 'SDX_AWARD'
  | 'MATCH_END'
  | 'MANUAL';

export interface SnapshotState {
  match_id: string;
  round_number: number;
  replay_tick: number;
  player_states: Record<string, {
    player_id: string;
    running_score: number;    // Q32.32 fixed-point integer
    fd_balance_delta: number; // Q32.32 fixed-point integer
    pdx_balance_delta: number;// Q32.32 fixed-point integer
    sdx_balance_delta: number;// Q32.32 fixed-point integer
  }>;
  ledger_running_totals: {
    total_fd_emitted: number;  // Q32.32 fixed-point integer
    total_pdx_awarded: number; // Q32.32 fixed-point integer
    total_sdx_awarded: number; // Q32.32 fixed-point integer
    reconciliation_check: boolean;
  };
  rtp_running_average: number; // Q32.32 fixed-point integer
  board_state: number[][];
  class_archetypes: Record<string, ClassArchetype>;
}

export interface EventSnapshot {
  snapshot_version: SchemaVersion;
  snapshot_id: string;
  event_index: number;
  event_id_at_snapshot: string;
  state_hash: string;
  predecessor_snapshot_hash: string;
  state: SnapshotState;
  snapshot_trigger: SnapshotTrigger;
  created_at: string;
  schema_version_at_snapshot: SchemaVersion;
  blockchain_tx_id?: string;
  sdx_amount?: number; // Q32.32 fixed-point integer
}

export interface MatchInputLog {
  sessionSeed: string;
  roomId: string;
  matchId: string;
  roundNumber: number;
  classArchetype: ClassArchetype;
  inputs: Array<{
    tick: number;
    type: 'TILE_SWAP' | 'POCKET_DEPLOY' | 'MATCH_PASS';
    payload: Record<string, unknown>;
  }>;
}

export interface ReplayResult {
  finalState: Record<string, unknown>;
  finalStateHash: string;
  matchesStoredHash: boolean;
  replayTicks: number;
  eventsProcessed: number;
}
