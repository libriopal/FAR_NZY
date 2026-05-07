// ─── Edge Function: send-gift ─────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAILY_GIFT_LIMIT = 5;
const MAX_GIFT_AMOUNT = 500;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await sb.auth.getUser(authHeader?.replace('Bearer ', '') ?? '');
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { to_user_id, gift_type, amount } = await req.json();

  if (!to_user_id || !gift_type || !amount || amount > MAX_GIFT_AMOUNT) {
    return new Response(JSON.stringify({ error: 'Invalid gift params' }), { status: 400, headers: corsHeaders });
  }

  if (to_user_id === user.id) {
    return new Response(JSON.stringify({ error: 'Cannot gift yourself' }), { status: 400, headers: corsHeaders });
  }

  // ── Daily limit check ──
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count } = await sb
    .from('gifts')
    .select('*', { count: 'exact', head: true })
    .eq('from_user_id', user.id)
    .gte('created_at', todayStart.toISOString());

  if ((count ?? 0) >= DAILY_GIFT_LIMIT) {
    return new Response(JSON.stringify({ error: 'Daily gift limit reached' }), { status: 429, headers: corsHeaders });
  }

  // ── Debit from sender (for gold coin gifts) ──
  if (gift_type === 'goldCoins') {
    const { data: balance } = await sb.from('economy_balances').select('gold_coins').eq('user_id', user.id).single();
    if (!balance || balance.gold_coins < amount) {
      return new Response(JSON.stringify({ error: 'Insufficient balance' }), { status: 400, headers: corsHeaders });
    }
    await sb.from('economy_balances').update({ gold_coins: balance.gold_coins - amount }).eq('user_id', user.id);
  }

  // ── Create gift record ──
  const { error } = await sb.from('gifts').insert({
    from_user_id: user.id,
    to_user_id,
    gift_type,
    amount,
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
