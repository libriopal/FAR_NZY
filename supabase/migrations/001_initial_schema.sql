-- ─── The Living Blueprint: Glass Greenhouse Estate ───────────────────────────
-- Initial Schema Migration
-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Profiles ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Compliance Flags ────────────────────────────────────────────────────────
create table public.compliance_flags (
  user_id uuid references auth.users(id) on delete cascade primary key,
  age_verified boolean not null default false,
  state_allowed boolean not null default false,
  terms_accepted boolean not null default false,
  terms_accepted_at timestamptz,
  restricted_state text,
  min_age_required smallint not null default 18,
  verified_at timestamptz not null default now()
);

alter table public.compliance_flags enable row level security;
-- Users can read own compliance flags; only edge functions can write
create policy "compliance_read_own" on public.compliance_flags
  for select using (auth.uid() = user_id);
create policy "compliance_insert_service" on public.compliance_flags
  for insert with check (auth.role() = 'service_role');
create policy "compliance_update_service" on public.compliance_flags
  for update using (auth.role() = 'service_role');

-- ─── Economy Balances ────────────────────────────────────────────────────────
create table public.economy_balances (
  user_id uuid references auth.users(id) on delete cascade primary key,
  gold_coins bigint not null default 0 check (gold_coins >= 0),
  sweeps_coins bigint not null default 0 check (sweeps_coins >= 0),
  updated_at timestamptz not null default now()
);

alter table public.economy_balances enable row level security;
create policy "economy_read_own" on public.economy_balances
  for select using (auth.uid() = user_id);
-- Writes ONLY via service_role (Edge Functions)
create policy "economy_write_service" on public.economy_balances
  for all using (auth.role() = 'service_role');

-- ─── Transactions (append-only ledger) ───────────────────────────────────────
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete restrict not null,
  type text not null,
  currency text not null check (currency in ('goldCoins', 'sweepsCoins')),
  amount bigint not null,
  balance_before bigint not null,
  balance_after bigint not null,
  metadata jsonb not null default '{}',
  server_validated boolean not null default false,
  blockchain_tx_hash text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
create policy "txn_read_own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "txn_write_service" on public.transactions
  for insert with check (auth.role() = 'service_role');
-- No updates/deletes on ledger — immutable

create index idx_transactions_user_ts on public.transactions(user_id, created_at desc);

-- ─── Player Saves (Cloud Save) ───────────────────────────────────────────────
create table public.player_saves (
  user_id uuid references auth.users(id) on delete cascade primary key,
  meta_resources jsonb not null default '{"bioSteel":0,"aeroSeeds":0,"goldCoins":0,"sweepsCoins":0}',
  purchased_upgrade_ids text[] not null default '{}',
  level_progress jsonb not null default '{}',
  compliance_flags jsonb not null default '{}',
  ab_assignments jsonb not null default '{}',
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;
create policy "saves_self" on public.player_saves
  for all using (auth.uid() = user_id);

-- ─── Leaderboard Entries ─────────────────────────────────────────────────────
create table public.leaderboard_entries (
  user_id uuid references auth.users(id) on delete cascade,
  level_id text not null,
  score bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, level_id)
);

alter table public.leaderboard_entries enable row level security;
create policy "lb_read_all" on public.leaderboard_entries
  for select using (true);
create policy "lb_write_own" on public.leaderboard_entries
  for all using (auth.uid() = user_id);

create index idx_leaderboard_level_score on public.leaderboard_entries(level_id, score desc);

-- Rank function
create or replace function public.get_leaderboard_rank(p_user_id uuid, p_level_id text)
returns bigint language sql stable as $$
  select count(*) + 1
  from public.leaderboard_entries
  where level_id = p_level_id
    and score > (
      select score from public.leaderboard_entries
      where user_id = p_user_id and level_id = p_level_id
    );
$$;

-- ─── Gifts ───────────────────────────────────────────────────────────────────
create table public.gifts (
  id uuid primary key default uuid_generate_v4(),
  from_user_id uuid references auth.users(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete cascade not null,
  gift_type text not null,
  amount bigint not null default 0,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

alter table public.gifts enable row level security;
create policy "gifts_receive" on public.gifts
  for select using (auth.uid() = to_user_id);
create policy "gifts_send_service" on public.gifts
  for insert with check (auth.role() = 'service_role');
create policy "gifts_claim_own" on public.gifts
  for update using (auth.uid() = to_user_id);

create index idx_gifts_to_unclaimed on public.gifts(to_user_id, claimed) where not claimed;

-- ─── Guilds ──────────────────────────────────────────────────────────────────
create table public.guilds (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  owner_user_id uuid references auth.users(id) on delete restrict not null,
  member_count int not null default 1,
  created_at timestamptz not null default now()
);

create table public.guild_members (
  guild_id uuid references public.guilds(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','officer','member')),
  weekly_contribution int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
create policy "guild_read_all" on public.guilds for select using (true);
create policy "guild_members_read" on public.guild_members for select using (true);
create policy "guild_members_self" on public.guild_members
  for all using (auth.uid() = user_id);

-- ─── Analytics Events ────────────────────────────────────────────────────────
create table public.analytics_events (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  props jsonb not null default '{}',
  user_id uuid not null,
  session_id text not null,
  timestamp timestamptz not null,
  platform text not null default 'web',
  app_version text not null default '1.0.0',
  cohort_id text
);

-- No RLS — insert-only via service_role from edge function
alter table public.analytics_events enable row level security;
create policy "analytics_write_service" on public.analytics_events
  for insert with check (auth.role() = 'service_role');

create index idx_analytics_user_ts on public.analytics_events(user_id, timestamp desc);
create index idx_analytics_name on public.analytics_events(name, timestamp desc);

-- ─── Blockchain Log ──────────────────────────────────────────────────────────
create table public.blockchain_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete restrict not null,
  entry_type text not null,
  payload_hash text not null,
  tx_hash text,
  block_number bigint,
  chain_status text not null default 'pending' check (chain_status in ('pending','confirmed','failed')),
  created_at timestamptz not null default now()
);

alter table public.blockchain_log enable row level security;
create policy "blockchain_read_own" on public.blockchain_log
  for select using (auth.uid() = user_id);
create policy "blockchain_write_service" on public.blockchain_log
  for all using (auth.role() = 'service_role');

-- ─── Quest Cache ─────────────────────────────────────────────────────────────
create table public.quest_cache (
  cache_key text primary key,
  quest_json jsonb not null,
  hit_count int not null default 0,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.quest_cache enable row level security;
create policy "quest_cache_service" on public.quest_cache
  for all using (auth.role() = 'service_role');
