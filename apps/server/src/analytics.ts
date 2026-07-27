// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Supabase analytics wrappers. Fire-and-forget only.
// Never throw. Never block the game loop.
// ─────────────────────────────────────────────────────

/*
  Supabase migration (run once in SQL editor before first session):

  CREATE TABLE IF NOT EXISTS session_analytics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       TEXT NOT NULL,
    mode            TEXT NOT NULL,
    seed_hash       TEXT NOT NULL,
    started_at      TIMESTAMPTZ DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    total_chains    INTEGER DEFAULT 0,
    scoring_chains  INTEGER DEFAULT 0,
    farkle_count    INTEGER DEFAULT 0,
    banks_taken     INTEGER DEFAULT 0,
    peak_multiplier NUMERIC DEFAULT 1.0,
    final_banked    INTEGER DEFAULT 0,
    final_score     INTEGER DEFAULT 0,
    avg_chain_score NUMERIC DEFAULT 0,
    skill_score     NUMERIC DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chain_decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES session_analytics(id) ON DELETE CASCADE,
    player_id       TEXT NOT NULL,
    chain_number    INTEGER NOT NULL,
    faces_played    INTEGER[] NOT NULL,
    score_result    INTEGER NOT NULL,
    multiplier_at   NUMERIC NOT NULL,
    unbanked_before INTEGER NOT NULL,
    decision        TEXT NOT NULL CHECK (decision IN ('CONTINUE','BANK','PASS','FARKLE')),
    was_optimal     BOOLEAN NOT NULL,
    timestamp       TIMESTAMPTZ DEFAULT now()
  );

  -- Index for legal defense query performance (idx_session_skill)
  CREATE INDEX idx_session_skill ON session_analytics(skill_score DESC);
  CREATE INDEX idx_session_player ON session_analytics(player_id, started_at DESC);
  CREATE INDEX idx_decisions_session ON chain_decisions(session_id);
*/

import { computeSkillScore } from './skillMetrics.js';
import type { SessionAnalytics, ChainDecision } from './skillMetrics.js';
import { getSupabaseClient as getClient } from './evidence/supabaseClient.js';

export async function insertSession(session: Omit<SessionAnalytics, 'skill_score'>): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    const skill_score = computeSkillScore(session);
    // §36 Research Epoch — human-set label via env, never derived from gameplay.
    const epoch_id = process.env['EVIDENCE_EPOCH_ID'] ?? null;
    await client.from('session_analytics').upsert({ ...session, skill_score, epoch_id });
  } catch (e) {
    console.error('[analytics] insertSession failed:', e);
  }
}

export function insertChainDecision(decision: ChainDecision): void {
  const client = getClient();
  if (!client) return;
  client.from('chain_decisions').insert(decision)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then(() => { /* fire-and-forget */ }).catch((e: any) => {
      console.error('[analytics] insertChainDecision failed:', e);
    });
}

export async function getSkillPercentile(player_id: string): Promise<number> {
  try {
    const client = getClient();
    if (!client) return 0;
    const { data } = await client
      .from('session_analytics')
      .select('skill_score')
      .eq('player_id', player_id)
      .order('started_at', { ascending: false })
      .limit(100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!data || data.length === 0) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.reduce((s: number, r: any) => s + (r.skill_score as number), 0) / data.length;
  } catch (e) {
    console.error('[analytics] getSkillPercentile failed:', e);
    return 0;
  }
}

export async function getSkillDifferentialReport(): Promise<{ topDecile: number; bottomHalf: number; ratio: number }> {
  try {
    const client = getClient();
    if (!client) return { topDecile: 0, bottomHalf: 0, ratio: 1 };
    // Uses idx_session_skill index
    const { data } = await client
      .from('session_analytics')
      .select('skill_score, final_score')
      .order('skill_score', { ascending: false });
    if (!data || data.length === 0) return { topDecile: 0, bottomHalf: 0, ratio: 1 };
    const topN = Math.max(1, Math.floor(data.length * 0.1));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topDecile = data.slice(0, topN).reduce((s: number, r: any) => s + (r.final_score as number), 0) / topN;
    const bottomSlice = data.slice(Math.floor(data.length * 0.5));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bottomHalf = bottomSlice.reduce((s: number, r: any) => s + (r.final_score as number), 0) / Math.max(1, bottomSlice.length);
    return { topDecile, bottomHalf, ratio: bottomHalf > 0 ? topDecile / bottomHalf : 1 };
  } catch (e) {
    console.error('[analytics] getSkillDifferentialReport failed:', e);
    return { topDecile: 0, bottomHalf: 0, ratio: 1 };
  }
}
