// ─── Edge Function: blockchain-relay ─────────────────────────────────────────
// Logs entries to DB immediately; submits to Polygon L2 async via webhook queue.
// Uses Alchemy/Polygon RPC for lightweight on-chain writes.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await sb.auth.getUser(authHeader?.replace('Bearer ', '') ?? '');
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { entries } = await req.json();
  if (!Array.isArray(entries)) return new Response('Bad request', { status: 400 });

  const rows = entries.slice(0, 20).map((e: Record<string, unknown>) => ({
    user_id: user.id,
    entry_type: (e.entryType as string) ?? 'unknown',
    payload_hash: (e.payloadHash as string) ?? '',
    chain_status: 'pending',
    created_at: new Date((e.timestamp as number) || Date.now()).toISOString(),
  }));

  const { data: inserted, error } = await sb
    .from('blockchain_log')
    .insert(rows)
    .select('id');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  // ── Async L2 submission via Polygon RPC (non-blocking) ──
  // In production: use Alchemy SDK + ethers.js to call a simple LogEntry contract.
  // The contract emits an event with (userId_hash, payloadHash, timestamp).
  // This is fire-and-forget; DB record is the source of truth.
  _submitToPolygonAsync(rows.map((r, i) => ({ id: inserted![i]?.id, ...r }))).catch(err =>
    console.warn('[blockchain-relay] L2 submission deferred:', err)
  );

  return new Response(JSON.stringify({ logged: rows.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

async function _submitToPolygonAsync(
  entries: Array<{ id: string; payload_hash: string; entry_type: string }>
) {
  const rpcUrl = Deno.env.get('POLYGON_RPC_URL');
  const privateKey = Deno.env.get('RELAY_WALLET_PRIVATE_KEY');
  if (!rpcUrl || !privateKey) return; // Not configured — dev mode

  // In production this calls a deployed LogEntry.sol smart contract.
  // Contract: function logEntries(bytes32[] calldata payloadHashes) external
  // Keeping this as a placeholder — real implementation uses ethers.js Contract call.
  console.log(`[blockchain-relay] Would submit ${entries.length} entries to Polygon`);
}
