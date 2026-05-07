// ─── Edge Function: ingest-analytics ─────────────────────────────────────────
// Batch insert analytics events from client flush.

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

  const { events } = await req.json();
  if (!Array.isArray(events) || events.length === 0) {
    return new Response(JSON.stringify({ inserted: 0 }), { headers: corsHeaders });
  }

  const rows = events
    .filter((e): e is Record<string, unknown> => e && typeof e.name === 'string')
    .slice(0, 100) // max 100 per batch
    .map((e) => ({
      name: e.name as string,
      props: e.props ?? {},
      user_id: user.id, // always use authenticated user, never trust client userId
      session_id: (e.session_id as string) ?? '',
      timestamp: new Date((e.timestamp as number) || Date.now()).toISOString(),
      platform: (e.platform as string) ?? 'web',
      app_version: (e.app_version as string) ?? '1.0.0',
      cohort_id: (e.cohort_id as string) ?? null,
    }));

  const { error } = await sb.from('analytics_events').insert(rows);
  if (error) {
    console.error('[ingest-analytics]', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ inserted: rows.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
