// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// D2 Stage-1 evidence types. Raw-only — no derived competency fields.
// Source: D2_STAGE1_RESEARCH_ENVIRONMENT_HANDOFF_V3.md §17/§18/§31-§33.
// ─────────────────────────────────────────────────────

/** Fields forbidden anywhere in the evidence path (anti-circularity law, §2/§16). */
export const FORBIDDEN_EVIDENCE_FIELDS = ['skill_score', 'was_optimal'] as const;

export type DiscoveryEventType =
  | 'discovery_claim'
  | 'theory_created'
  | 'hypothesis_recorded'
  | 'question_created'
  | 'session_retrospective';

export interface DiscoveryEvent {
  id?: string | undefined;
  session_id?: string | undefined;
  player_id: string;
  epoch_id?: string | undefined;
  event_type: DiscoveryEventType;
  /** Raw human words. Never an AI inference or interpretation. */
  text: string;
  context?: Record<string, unknown> | undefined;
  created_at?: string | undefined;
}

export interface Experiment {
  experiment_id: string;
  epoch_id?: string;
  question: string;
  surface?: string;
  captured_fields?: string[];
  /** Indicator-only. Must never phrase a signal as a competency/enjoyment claim. */
  signal_definition?: string;
  enabled?: boolean;
  started_at?: string;
  ended_at?: string;
}

export type EvidenceClassification = 'VF' | 'SI' | 'AS' | 'SP' | 'SC';

export interface Hypothesis {
  hypothesis_id: string;
  epoch_id?: string;
  question: string;
  classification: EvidenceClassification;
  registered_at?: string;
}

/** Throws if any forbidden field name appears in captured_fields. */
export function assertNoForbiddenFields(captured_fields: string[] | undefined): void {
  if (!captured_fields) return;
  const hit = captured_fields.find((f) => (FORBIDDEN_EVIDENCE_FIELDS as readonly string[]).includes(f));
  if (hit) {
    throw new Error(`[evidence] forbidden field "${hit}" may not appear in captured_fields (anti-circularity law)`);
  }
}
