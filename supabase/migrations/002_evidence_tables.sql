-- ─── D2 Stage-1 Research Environment — Evidence Tables ───────────────────────
-- Additive only. Does not alter any frozen contract or CORE-locked behavior.
-- Source: D2_STAGE1_RESEARCH_ENVIRONMENT_HANDOFF_V3.md §12/§16/§17/§18/§31-§39.
--
-- session_analytics / chain_decisions are brought under formal migration
-- tracking here (they previously existed only as the manual SQL comment in
-- apps/server/src/analytics.ts) — `if not exists` makes this safe to run
-- whether or not they were already created by hand.

create table if not exists public.session_analytics (
  id              uuid primary key default gen_random_uuid(),
  player_id       text not null,
  mode            text not null,
  seed_hash       text not null,
  started_at      timestamptz default now(),
  ended_at        timestamptz,
  total_chains    integer default 0,
  scoring_chains  integer default 0,
  farkle_count    integer default 0,
  banks_taken     integer default 0,
  peak_multiplier numeric default 1.0,
  final_banked    integer default 0,
  final_score     integer default 0,
  avg_chain_score numeric default 0,
  skill_score     numeric default 0
);

create table if not exists public.chain_decisions (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references public.session_analytics(id) on delete cascade,
  player_id       text not null,
  chain_number    integer not null,
  faces_played    integer[] not null,
  score_result    integer not null,
  multiplier_at   numeric not null,
  unbanked_before integer not null,
  decision        text not null check (decision in ('CONTINUE','BANK','PASS','FARKLE')),
  was_optimal     boolean not null,
  timestamp       timestamptz default now()
);

create index if not exists idx_session_skill on public.session_analytics(skill_score desc);
create index if not exists idx_session_player on public.session_analytics(player_id, started_at desc);
create index if not exists idx_decisions_session on public.chain_decisions(session_id);

-- §36 Research Epoch — pure label, no evaluation. Attached to sessions,
-- experiments, hypotheses, and the export manifest.
-- Depends on session_analytics existing (created above, `if not exists` —
-- safe whether this migration runs first or after a hand-run copy of the
-- schema in analytics.ts's original comment block).
alter table public.session_analytics add column if not exists epoch_id text;

-- ─── Discovery Events (§31) ───────────────────────────────────────────────────
-- Raw human statements only — never an AI inference, never scored.
create table if not exists public.discovery_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references public.session_analytics(id) on delete cascade,
  player_id   text not null,
  epoch_id    text,
  event_type  text not null check (event_type in (
                'discovery_claim',
                'theory_created',
                'hypothesis_recorded',
                'question_created',
                'session_retrospective'
              )),
  text        text not null,
  context     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.discovery_events enable row level security;
create policy "discovery_events_write_service" on public.discovery_events
  for insert with check (auth.role() = 'service_role');
create policy "discovery_events_read_service" on public.discovery_events
  for select using (auth.role() = 'service_role');

create index if not exists idx_discovery_session on public.discovery_events(session_id);
create index if not exists idx_discovery_epoch on public.discovery_events(epoch_id, created_at desc);

-- ─── Experiment Registry (§32) ────────────────────────────────────────────────
-- Configurable data, not hardcoded telemetry. signal_definition is indicator-
-- only and must never phrase a signal as a competency/enjoyment claim.
create table if not exists public.experiments (
  experiment_id     text primary key,
  epoch_id          text,
  question          text not null,
  surface           text,
  captured_fields   text[] not null default '{}',
  signal_definition text,
  enabled           boolean not null default true,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz
);

alter table public.experiments enable row level security;
create policy "experiments_write_service" on public.experiments
  for all using (auth.role() = 'service_role');

-- ─── Hypothesis Registry (§33) ────────────────────────────────────────────────
-- Registration only. Never marked confirmed/falsified in Stage 1 — that
-- requires human evidence in a later stage.
create table if not exists public.hypotheses (
  hypothesis_id  text primary key,
  epoch_id       text,
  question       text not null,
  classification text not null check (classification in ('VF','SI','AS','SP','SC')),
  registered_at  timestamptz not null default now()
);

alter table public.hypotheses enable row level security;
create policy "hypotheses_write_service" on public.hypotheses
  for all using (auth.role() = 'service_role');
