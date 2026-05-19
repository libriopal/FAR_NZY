// ─────────────────────────────────────────────────────────────────────────────
// analytics.ts — CASINO COMPLIANCE AUDIT TRAIL
// ─────────────────────────────────────────────────────────────────────────────
//
// PURPOSE (regulatory framing):
//   This module records every casino-mode session and every individual chain
//   decision made during those sessions. The data exists for one reason:
//   to satisfy regulatory requirements that skill-based wagering games can
//   demonstrate — with historical evidence — that outcomes correlate with
//   player skill, not chance alone.
//
// CASINO MODES ONLY: SOLO_CASINO, VS_CASINO, RALLY_CASINO, HEIST_CASINO
//   Free modes (*_FREE) are NOT recorded here. Free play carries no stake
//   and therefore generates no compliance obligation. Recording it would
//   dilute the skill-correlation signal and bloat the dataset with noise.
//
// WHAT IS STORED:
//   session_analytics — one row per completed casino session:
//     - seed_hash: SHA-256 commitment made before play (provable fairness)
//     - skill_score: composite metric (chain quality + bank efficiency + farkle resistance)
//     - final_score: final banked total — the outcome regulators audit
//     - mode: game mode (CASINO suffix enforced by CHECK constraint below)
//
//   chain_decisions — one row per chain submission in a casino session:
//     - faces_played: exact dice committed (reproducible from seed)
//     - was_optimal: whether the bank/continue decision was mathematically correct
//     - score_result, multiplier_at: full scoring context for post-hoc audit
//
// KEY REGULATORY QUERIES (see getSkillDifferentialReport):
//   Q1: Top-decile skill_score players → their final_score should be statistically
//       higher than bottom-half players. A ratio > 1.5 demonstrates skill dependency.
//   Q2: was_optimal correlation with win rate — players making better decisions
//       should win more frequently than random play (p < 0.05).
//   Q3: farkle_count / total_chains ratio — skilled players < 15%; random ≈ 37%.
//
// RUNTIME BEHAVIOUR:
//   All writes are fire-and-forget: they never throw, never block the game loop.
//   If Supabase is unreachable (SUPABASE_URL / SUPABASE_SERVICE_KEY not set),
//   functions silently return — game proceeds, compliance writes are lost.
//   TODO: add write-ahead local fallback for offline resilience.
// ─────────────────────────────────────────────────────────────────────────────

/*
  ── Supabase migration (run once in SQL editor before first casino session) ──

  -- Casino compliance session log
  CREATE TABLE IF NOT EXISTS session_analytics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       TEXT NOT NULL,
    mode            TEXT NOT NULL
                      CHECK (mode IN ('SOLO_CASINO','VS_CASINO','RALLY_CASINO','HEIST_CASINO')),
    seed_hash       TEXT NOT NULL,   -- SHA-256(serverSeed) committed before first roll
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
    skill_score     NUMERIC DEFAULT 0,  -- computed from chain_decisions at session end
    -- Compliance fields for disputed-payout reconstruction (added v2)
    payout_amount   NUMERIC,            -- actual FD/PDX paid to this player at session end
    rtp_actual      NUMERIC,            -- realized RTP: payout_amount / (stake + ante_total)
    ante_total      NUMERIC,            -- sum of all antes this player paid this session
    final_pot       NUMERIC,            -- total pot at session end (all stakes + all antes)
    fee_removed_reason TEXT             -- audit trail marker, e.g. 'VS_CASINO_PLATFORM_FEE_REMOVED_v2'
  );

  -- wallet_transactions — every wager, payout, ante, and bonus write
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       TEXT NOT NULL,
    session_id      UUID REFERENCES session_analytics(id) ON DELETE SET NULL,
    type            TEXT NOT NULL CHECK (type IN (
                      'FD_WAGER','PDX_WAGER','FD_AWARD','PDX_AWARD',
                      'FD_ANTE','PDX_ANTE','MILESTONE_PAYOUT','RALLY_SPLIT',
                      'FD_PURCHASE','PDX_GIFT','PDX_DAILY_BONUS','PDX_REDEEM','PDX_PROMO'
                    )),
    currency        TEXT NOT NULL CHECK (currency IN ('FD','PDX')),
    amount          NUMERIC NOT NULL,    -- positive = credit, negative = debit
    balance_after   NUMERIC NOT NULL,
    ante_stage      TEXT,               -- e.g. 'PRE_GAME', 'MILESTONE_2' for ante rows
    timestamp       TIMESTAMPTZ DEFAULT now(),
    notes           TEXT
  );

  CREATE INDEX idx_wallet_player   ON wallet_transactions(player_id, timestamp DESC);
  CREATE INDEX idx_wallet_session  ON wallet_transactions(session_id);
  CREATE INDEX idx_wallet_type     ON wallet_transactions(type);

  -- Per-chain decision log for skill-dependency proof
  CREATE TABLE IF NOT EXISTS chain_decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES session_analytics(id) ON DELETE CASCADE,
    player_id       TEXT NOT NULL,
    chain_number    INTEGER NOT NULL,
    faces_played    INTEGER[] NOT NULL,   -- exact dice committed; reproducible from seed
    score_result    INTEGER NOT NULL,
    multiplier_at   NUMERIC NOT NULL,
    unbanked_before INTEGER NOT NULL,
    decision        TEXT NOT NULL CHECK (decision IN ('CONTINUE','BANK','PASS','FARKLE')),
    was_optimal     BOOLEAN NOT NULL,     -- true if decision maximised expected value
    timestamp       TIMESTAMPTZ DEFAULT now()
  );

  -- Regulatory query performance
  CREATE INDEX idx_session_skill   ON session_analytics(skill_score DESC);
  CREATE INDEX idx_session_player  ON session_analytics(player_id, started_at DESC);
  CREATE INDEX idx_session_mode    ON session_analytics(mode);           -- casino filter
  CREATE INDEX idx_decisions_session ON chain_decisions(session_id);
  CREATE INDEX idx_decisions_optimal ON chain_decisions(was_optimal, player_id);
*/

import { computeSkillScore } from './skillMetrics.js';
import type { SessionAnalytics, ChainDecision } from './skillMetrics.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClient(): any {
  if (_client) return _client;
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  if (!url || !key) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js');
    _client = createClient(url, key);
  } catch {
    _client = null;
  }
  return _client;
}

// Write one session record. Casino modes only — free-mode sessions are not
// subject to compliance requirements and are intentionally excluded.
export async function insertSession(session: Omit<SessionAnalytics, 'skill_score'>): Promise<void> {
  // Compliance gate: only SOLO_CASINO / VS_CASINO / RALLY_CASINO / HEIST_CASINO
  if (!session.mode.endsWith('_CASINO')) return;
  try {
    const client = getClient();
    if (!client) return;
    const skill_score = computeSkillScore(session);
    await client.from('session_analytics').upsert({ ...session, skill_score });
  } catch (e) {
    console.error('[analytics] insertSession failed:', e);
  }
}

// Write one chain decision row. Callers (gameRoom.processChain) guard this
// with isCasino before calling — this function trusts that gate.
export function insertChainDecision(decision: ChainDecision): void {
  const client = getClient();
  if (!client) return;
  client.from('chain_decisions').insert(decision)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then(() => { /* fire-and-forget */ }).catch((e: any) => {
      console.error('[analytics] insertChainDecision failed:', e);
    });
}

// Returns average skill_score across the player's last 100 CASINO sessions.
// Used to display a skill rating to the player and to compute regulator reports.
export async function getSkillPercentile(player_id: string): Promise<number> {
  try {
    const client = getClient();
    if (!client) return 0;
    const { data } = await client
      .from('session_analytics')
      .select('skill_score')
      .eq('player_id', player_id)
      .ilike('mode', '%_CASINO')          // casino sessions only
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

// Primary regulatory evidence report.
// Compares average final_score of top-10% skill players vs bottom-50% skill players.
// A ratio > 1.5 demonstrates skill dependency: skilled players consistently score higher.
// Run this against your casino session history to produce regulator evidence.
// Uses idx_session_skill + idx_session_mode indexes for performance.
export async function getSkillDifferentialReport(): Promise<{ topDecile: number; bottomHalf: number; ratio: number }> {
  try {
    const client = getClient();
    if (!client) return { topDecile: 0, bottomHalf: 0, ratio: 1 };
    const { data } = await client
      .from('session_analytics')
      .select('skill_score, final_score')
      .ilike('mode', '%_CASINO')          // casino sessions only — compliance scope
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

// ── Wallet transaction ledger ─────────────────────────────────────────────────
// Every wager, award, ante, rally split, and milestone payout writes one row.
// Provides a complete audit trail for disputed payouts.

export interface WalletTransactionRow {
  player_id: string;
  session_id?: string;
  type: string;
  currency: 'FD' | 'PDX';
  amount: number;           // positive = credit to player, negative = debit
  balance_after: number;
  ante_stage?: string;      // 'PRE_GAME' | 'MILESTONE_1' ... for ante rows
  notes?: string;
}

// Fire-and-forget wallet write. Never throws — game loop must not stall on
// compliance writes. If Supabase is unreachable the row is lost silently.
// TODO: wire a local write-ahead buffer for offline resilience.
export function insertWalletTransaction(tx: WalletTransactionRow): void {
  const client = getClient();
  if (!client) return;
  client.from('wallet_transactions').insert(tx)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then(() => { /* fire-and-forget */ }).catch((e: any) => {
      console.error('[analytics] insertWalletTransaction failed:', e);
    });
}
