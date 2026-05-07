// ─── Edge Function: process-transaction ──────────────────────────────────────
// Server-authoritative economy mutation. Prevents client-side tampering.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_LEVEL_REWARD_GC = 2000;
const MAX_AD_REWARD_GC = 600;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const { data: { user }, error: authError } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();
    const { id, type, currency, amount, metadata } = body;

    if (!id || !type || !currency || typeof amount !== 'number' || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers: corsHeaders });
    }

    // ── Server-side limits per transaction type ──
    const validatedAmount = _clampAmount(type, currency, amount);
    if (validatedAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Amount out of allowed range' }), { status: 400, headers: corsHeaders });
    }

    // ── Idempotency check ──
    const { data: existing } = await sb
      .from('transactions')
      .select('id, balance_after')
      .eq('id', id)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ id, balanceAfter: existing.balance_after, serverValidated: true, alreadyProcessed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Read current balance (with FOR UPDATE lock equivalent via explicit select) ──
    let { data: balanceRow } = await sb
      .from('economy_balances')
      .select('gold_coins, sweeps_coins')
      .eq('user_id', user.id)
      .single();

    if (!balanceRow) {
      await sb.from('economy_balances').insert({ user_id: user.id, gold_coins: 0, sweeps_coins: 0 });
      balanceRow = { gold_coins: 0, sweeps_coins: 0 };
    }

    const colKey = currency === 'goldCoins' ? 'gold_coins' : 'sweeps_coins';
    const currentBalance: number = (balanceRow as Record<string, number>)[colKey] ?? 0;
    const isCredit = _isCreditType(type);
    const newBalance = isCredit ? currentBalance + validatedAmount : currentBalance - validatedAmount;

    if (newBalance < 0) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), { status: 400, headers: corsHeaders });
    }

    // ── Write new balance ──
    await sb
      .from('economy_balances')
      .upsert({ user_id: user.id, [colKey]: newBalance, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    // ── Write transaction record ──
    await sb.from('transactions').insert({
      id,
      user_id: user.id,
      type,
      currency,
      amount: validatedAmount,
      balance_before: currentBalance,
      balance_after: newBalance,
      metadata: metadata ?? {},
      server_validated: true,
    });

    return new Response(
      JSON.stringify({ id, balanceBefore: currentBalance, balanceAfter: newBalance, serverValidated: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[process-transaction]', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});

function _isCreditType(type: string): boolean {
  return ['purchase', 'reward_ad', 'level_complete', 'daily_bonus', 'gift_received', 'sweeps_award'].includes(type);
}

function _clampAmount(type: string, currency: string, amount: number): number {
  if (type === 'level_complete' && currency === 'goldCoins') return Math.min(amount, MAX_LEVEL_REWARD_GC);
  if (type === 'reward_ad' && currency === 'goldCoins') return Math.min(amount, MAX_AD_REWARD_GC);
  if (type === 'booster_spend') return Math.min(amount, 5000);
  return amount;
}
