// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// D2 Stage-1 evidence recorder. Supabase-backed, fire-and-forget only.
// Never throw into the caller. Never touches Sacred Core.
// Source: D2_STAGE1_RESEARCH_ENVIRONMENT_HANDOFF_V3.md §12/§31-§33.
// ─────────────────────────────────────────────────────

import { getSupabaseClient } from './supabaseClient.js';
import { assertNoForbiddenFields } from './types.js';
import type { DiscoveryEvent, Experiment, Hypothesis } from './types.js';

export function recordDiscoveryEvent(event: DiscoveryEvent): void {
  const client = getSupabaseClient();
  if (!client) return;
  client
    .from('discovery_events')
    .insert(event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then(() => { /* fire-and-forget */ }).catch((e: any) => {
      console.error('[evidence] recordDiscoveryEvent failed:', e);
    });
}

export async function upsertExperiment(experiment: Experiment): Promise<void> {
  assertNoForbiddenFields(experiment.captured_fields);
  try {
    const client = getSupabaseClient();
    if (!client) return;
    await client.from('experiments').upsert(experiment);
  } catch (e) {
    console.error('[evidence] upsertExperiment failed:', e);
  }
}

export async function listExperiments(epoch_id?: string): Promise<Experiment[]> {
  try {
    const client = getSupabaseClient();
    if (!client) return [];
    let query = client.from('experiments').select('*');
    if (epoch_id) query = query.eq('epoch_id', epoch_id);
    const { data } = await query;
    return (data ?? []) as Experiment[];
  } catch (e) {
    console.error('[evidence] listExperiments failed:', e);
    return [];
  }
}

export async function upsertHypothesis(hypothesis: Hypothesis): Promise<void> {
  try {
    const client = getSupabaseClient();
    if (!client) return;
    await client.from('hypotheses').upsert(hypothesis);
  } catch (e) {
    console.error('[evidence] upsertHypothesis failed:', e);
  }
}

export async function listHypotheses(epoch_id?: string): Promise<Hypothesis[]> {
  try {
    const client = getSupabaseClient();
    if (!client) return [];
    let query = client.from('hypotheses').select('*');
    if (epoch_id) query = query.eq('epoch_id', epoch_id);
    const { data } = await query;
    return (data ?? []) as Hypothesis[];
  } catch (e) {
    console.error('[evidence] listHypotheses failed:', e);
    return [];
  }
}

export async function listDiscoveryEvents(epoch_id?: string): Promise<DiscoveryEvent[]> {
  try {
    const client = getSupabaseClient();
    if (!client) return [];
    let query = client.from('discovery_events').select('*').order('created_at', { ascending: true });
    if (epoch_id) query = query.eq('epoch_id', epoch_id);
    const { data } = await query;
    return (data ?? []) as DiscoveryEvent[];
  } catch (e) {
    console.error('[evidence] listDiscoveryEvents failed:', e);
    return [];
  }
}
