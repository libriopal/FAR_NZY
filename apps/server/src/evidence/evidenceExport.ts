// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// D2 Stage-1 Evidence Return Package builder (§16/§34/§35).
// Raw-only. Strips every forbidden field at the projection boundary —
// this file is the single place that enforces the anti-circularity gate
// for exported data (source tables may still carry skill_score/was_optimal).
// ─────────────────────────────────────────────────────

import { execSync } from 'node:child_process';
import { getSupabaseClient } from './supabaseClient.js';
import { listExperiments, listHypotheses, listDiscoveryEvents } from './evidenceStore.js';
import type { DiscoveryEvent } from './types.js';

const EXPORT_VERSION = '1.0.0';

interface RawSession {
  id: string;
  player_id: string;
  mode: string;
  seed_hash: string;
  started_at: string;
  ended_at: string | null;
  total_chains: number;
  scoring_chains: number;
  farkle_count: number;
  banks_taken: number;
  peak_multiplier: number;
  final_banked: number;
  final_score: number;
  avg_chain_score: number;
  epoch_id: string | null;
  // present in the source table; stripped before it ever reaches an export field below
  skill_score?: number;
}

interface RawChainDecision {
  id: string;
  session_id: string;
  player_id: string;
  chain_number: number;
  faces_played: number[];
  score_result: number;
  multiplier_at: number;
  unbanked_before: number;
  decision: string;
  timestamp: string;
  // present in the source table; stripped before it ever reaches an export field below
  was_optimal?: boolean;
}

function gitField(cmd: string): string {
  try {
    return execSync(cmd, { cwd: process.cwd() }).toString().trim();
  } catch {
    return 'unknown';
  }
}

async function fetchSessions(epoch_id?: string): Promise<RawSession[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  let query = client.from('session_analytics').select('*');
  if (epoch_id) query = query.eq('epoch_id', epoch_id);
  const { data } = await query;
  return (data ?? []) as RawSession[];
}

async function fetchChainDecisions(sessionIds: string[]): Promise<RawChainDecision[]> {
  const client = getSupabaseClient();
  if (!client || sessionIds.length === 0) return [];
  const { data } = await client.from('chain_decisions').select('*').in('session_id', sessionIds);
  return (data ?? []) as RawChainDecision[];
}

/** §17: allowed evidence fields only — decision/outcome/timestamp/response/event/session. */
function projectBehaviorLog(decisions: RawChainDecision[]) {
  return decisions.map((d) => ({
    session_id: d.session_id,
    player_id: d.player_id,
    chain_number: d.chain_number,
    faces_played: d.faces_played,
    score_result: d.score_result,
    multiplier_at: d.multiplier_at,
    unbanked_before: d.unbanked_before,
    decision: d.decision,
    timestamp: d.timestamp,
  }));
}

function projectParticipantJourney(sessions: RawSession[]) {
  const byPlayer = new Map<string, RawSession[]>();
  for (const s of sessions) {
    const list = byPlayer.get(s.player_id) ?? [];
    list.push(s);
    byPlayer.set(s.player_id, list);
  }
  return [...byPlayer.entries()].map(([player_id, playerSessions]) => ({
    player_id,
    sessions: playerSessions
      .sort((a, b) => (a.started_at < b.started_at ? -1 : 1))
      .map((s) => ({
        session_id: s.id,
        mode: s.mode,
        seed_hash: s.seed_hash,
        started_at: s.started_at,
        ended_at: s.ended_at,
        total_chains: s.total_chains,
        scoring_chains: s.scoring_chains,
        farkle_count: s.farkle_count,
        banks_taken: s.banks_taken,
        peak_multiplier: s.peak_multiplier,
        final_banked: s.final_banked,
        final_score: s.final_score,
        avg_chain_score: s.avg_chain_score,
        epoch_id: s.epoch_id,
      })),
  }));
}

function projectDiscoveryEvent(e: DiscoveryEvent) {
  return {
    session_id: e.session_id,
    player_id: e.player_id,
    epoch_id: e.epoch_id,
    event_type: e.event_type,
    text: e.text,
    context: e.context ?? {},
    created_at: e.created_at,
  };
}

const RESPONSE_EVENT_TYPES = ['discovery_claim', 'theory_created', 'hypothesis_recorded', 'question_created'];

/** Throws (does not silently pass) if a forbidden field survived projection. */
function scanForForbiddenFields(payload: unknown): 'passed' {
  const json = JSON.stringify(payload);
  if (json.includes('"skill_score"') || json.includes('"was_optimal"')) {
    throw new Error('[evidence] forbidden field leaked into export payload — zero-forbidden-field gate failed (§21)');
  }
  return 'passed';
}

export interface EvidenceReturnPackage {
  evidence_manifest: Record<string, unknown>;
  experiments: unknown[];
  hypotheses: unknown[];
  behavior_log: unknown[];
  discovery_log: unknown[];
  participant_journey: unknown[];
  responses: unknown[];
  research_notes: unknown[];
}

/** Builds the §35 Evidence Return Package. Read-only against every table. */
export async function buildEvidenceReturnPackage(epoch_id?: string): Promise<EvidenceReturnPackage> {
  const sessions = await fetchSessions(epoch_id);
  const sessionIds = sessions.map((s) => s.id);
  const [decisions, experiments, hypotheses, discoveryEvents] = await Promise.all([
    fetchChainDecisions(sessionIds),
    listExperiments(epoch_id),
    listHypotheses(epoch_id),
    listDiscoveryEvents(epoch_id),
  ]);

  const behavior_log = projectBehaviorLog(decisions);
  const discovery_log = discoveryEvents.map(projectDiscoveryEvent);
  const participant_journey = projectParticipantJourney(sessions);
  const responses = discovery_log.filter((e) => RESPONSE_EVENT_TYPES.includes(e.event_type));
  const research_notes = discovery_log.filter((e) => e.event_type === 'session_retrospective');

  const participants = new Set(sessions.map((s) => s.player_id)).size;
  const epoch_ids_present = [...new Set(sessions.map((s) => s.epoch_id).filter((e): e is string => e != null))];

  const evidence_manifest = {
    stage: 'stage1',
    epoch_id: epoch_id ?? null,
    epoch_ids_present,
    build_version: process.env['npm_package_version'] ?? 'unknown',
    export_version: EXPORT_VERSION,
    generation_time: new Date().toISOString(),
    git_commit: gitField('git rev-parse HEAD'),
    branch: gitField('git rev-parse --abbrev-ref HEAD'),
    participants,
    sessions: sessions.length,
    experiment_ids: experiments.map((e) => e.experiment_id),
    hypothesis_ids: hypotheses.map((h) => h.hypothesis_id),
    files: [
      'evidence_manifest.json',
      'experiments.json',
      'hypotheses.json',
      'behavior_log.json',
      'discovery_log.json',
      'participant_journey.json',
      'responses.json',
      'research_notes.json',
    ],
    forbidden_field_scan: 'pending' as string,
  };

  const pkg: EvidenceReturnPackage = {
    evidence_manifest,
    experiments,
    hypotheses,
    behavior_log,
    discovery_log,
    participant_journey,
    responses,
    research_notes,
  };

  evidence_manifest.forbidden_field_scan = scanForForbiddenFields(pkg);

  return pkg;
}
