// ─── Supabase Backend Client ──────────────────────────────────────────────────
// Supabase chosen over Firebase for:
// - Row Level Security (RLS) = server-authoritative economy
// - Postgres = complex queries for cohort analytics
// - Edge Functions = Deno runtime, better perf than Firebase Functions cold starts
// - Native TypeScript support with auto-generated types

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';

export type { Database };

let _client: ReturnType<typeof createClient<Database>> | null = null;

export function initSupabaseClient(url: string, anonKey: string) {
  _client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

export function getSupabaseClient() {
  if (!_client) throw new Error('[Backend] Supabase client not initialized. Call initSupabaseClient first.');
  return _client;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signInAnonymous() {
  const sb = getSupabaseClient();
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

export async function signInWithEmail(email: string, password: string) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUpWithEmail(email: string, password: string) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

export async function getCurrentUser() {
  const sb = getSupabaseClient();
  const { data } = await sb.auth.getUser();
  return data.user;
}

export async function signOut() {
  const sb = getSupabaseClient();
  await sb.auth.signOut();
}

// ─── Cloud Save ───────────────────────────────────────────────────────────────

export interface CloudSaveData {
  meta_resources: Record<string, number>;
  purchased_upgrade_ids: string[];
  level_progress: Record<string, number>; // levelId -> best score
  compliance_flags: Record<string, unknown>;
  ab_assignments: Record<string, string>;
  settings: Record<string, unknown>;
}

export async function savePlayerData(userId: string, data: Partial<CloudSaveData>) {
  const sb = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('player_saves') as any)
    .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function loadPlayerData(userId: string): Promise<CloudSaveData | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('player_saves')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data as unknown as CloudSaveData;
}

// ─── Economy (server-authoritative via Edge Function) ────────────────────────

export async function processTransaction(req: {
  id: string;
  type: string;
  currency: string;
  amount: number;
  metadata: Record<string, unknown>;
}) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke('process-transaction', { body: req });
  if (error) throw error;
  return data;
}

// ─── Leaderboards ──────────────────────────────────────────────────────────────

export async function submitScore(levelId: string, score: number) {
  const sb = getSupabaseClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('leaderboard_entries') as any)
    .upsert({ user_id: user.id, level_id: levelId, score, updated_at: new Date().toISOString() }, { onConflict: 'user_id,level_id' });
  if (error) throw error;
}

export async function getLeaderboard(levelId: string, limit = 100) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('leaderboard_entries')
    .select('user_id, score, profiles(display_name, avatar_url)')
    .eq('level_id', levelId)
    .order('score', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ─── Social: Friends & Gifting ────────────────────────────────────────────────

export async function sendGift(toUserId: string, giftType: string, amount: number) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke('send-gift', {
    body: { to_user_id: toUserId, gift_type: giftType, amount },
  });
  if (error) throw error;
  return data;
}

export async function getPendingGifts(userId: string) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('gifts')
    .select('*')
    .eq('to_user_id', userId)
    .eq('claimed', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ─── Guilds ────────────────────────────────────────────────────────────────────

export async function createGuild(name: string, tag: string) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke('guild-action', {
    body: { action: 'create', name: name.slice(0, 30), tag: tag.slice(0, 4).toUpperCase() },
  });
  if (error) throw error;
  return data as { id: string; name: string; tag: string };
}

export async function joinGuild(guildId: string) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke('guild-action', {
    body: { action: 'join', guild_id: guildId },
  });
  if (error) throw error;
  return data;
}

export async function leaveGuild(guildId: string) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke('guild-action', {
    body: { action: 'leave', guild_id: guildId },
  });
  if (error) throw error;
  return data;
}

export async function getTopGuilds(limit = 20) {
  const sb = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from('guilds') as any)
    .select('id, name, tag, member_count, weekly_score')
    .order('weekly_score', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string; tag: string; member_count: number; weekly_score: number }>;
}

export async function getGuildLeaderboard(guildId: string) {
  const sb = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from('guild_members') as any)
    .select('user_id, weekly_contribution, profiles(display_name)')
    .eq('guild_id', guildId)
    .order('weekly_contribution', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Array<{ user_id: string; weekly_contribution: number; profiles: { display_name: string } | null }>;
}

export async function getGuild(guildId: string) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('guilds')
    .select('*, guild_members(user_id, role, weekly_contribution, profiles(display_name))')
    .eq('id', guildId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Analytics flush ─────────────────────────────────────────────────────────

export async function flushAnalyticsEvents(events: unknown[]) {
  const sb = getSupabaseClient();
  const { error } = await sb.functions.invoke('ingest-analytics', { body: { events } });
  if (error) console.warn('[Analytics] Flush failed:', error.message);
}

// ─── AI Quest fetch ───────────────────────────────────────────────────────────

export async function fetchQuestsForUser(userId: string) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke('generate-quests', { body: { user_id: userId } });
  if (error) throw error;
  return data?.quests ?? [];
}

// ─── Blockchain relay ────────────────────────────────────────────────────────

export async function relayBlockchainEntries(entries: unknown[]) {
  const sb = getSupabaseClient();
  const { error } = await sb.functions.invoke('blockchain-relay', { body: { entries } });
  if (error) console.warn('[Blockchain] Relay failed:', error.message);
}
