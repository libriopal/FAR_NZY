-- ─── Enable RLS on session_analytics / chain_decisions ───────────────────────
-- These two tables previously had no RLS — the schema in analytics.ts's
-- original comment block never specified it, and 002_evidence_tables.sql
-- carried that forward unchanged. Once the tables actually existed (they had
-- never been created in the live project before 002), that meant anyone
-- holding the anon key (shipped client-side as VITE_SUPABASE_ANON_KEY) could
-- read or write every player's session/chain data.
--
-- Both tables are only ever written/read server-side, via analytics.ts using
-- the service-role key — so a single service-role-only policy matches
-- existing access patterns (same shape as discovery_events in 002).

alter table public.session_analytics enable row level security;
alter table public.chain_decisions enable row level security;

create policy "session_analytics_service" on public.session_analytics
  for all using (auth.role() = 'service_role');
create policy "chain_decisions_service" on public.chain_decisions
  for all using (auth.role() = 'service_role');
