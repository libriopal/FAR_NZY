// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Shared lazy Supabase client, reused by analytics.ts and evidence/*.
// Fire-and-forget only. Never throw. Never block the game loop.
//
// NOT the same client as packages/backend-client's getSupabaseClient(). That
// one runs in the browser on the anon key and throws if uninitialized (fails
// loud — auth/economy calls must not silently no-op). This one runs on the
// server on the service-role key and returns null on missing env (fails
// quiet — analytics/evidence writes must never block or crash the game).
// Two names, deliberately two implementations; do not merge them.
// ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseClient(): any {
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
