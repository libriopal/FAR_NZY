// ─── Edge Function: generate-quests ──────────────────────────────────────────
// LLM-driven quest generation with aggressive caching.
// Cache key = userId + levelBucket + dominantCategory hash.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await sb.auth.getUser(authHeader?.replace('Bearer ', '') ?? '');
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { user_id } = await req.json();
  if (user_id !== user.id) return new Response('Forbidden', { status: 403 });

  // ── Read player context ──
  const { data: save } = await sb.from('player_saves').select('level_progress, meta_resources').eq('user_id', user_id).single();
  const levelProgress: Record<string, number> = (save?.level_progress as Record<string, number>) ?? {};
  const levelReached = Object.keys(levelProgress).length;

  // ── Cache key ──
  const levelBucket = Math.floor(levelReached / 5);
  const cacheKey = `quest:${levelBucket}`;

  // ── Check cache ──
  const { data: cached } = await sb.from('quest_cache')
    .select('quest_json, expires_at, hit_count')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (cached) {
    // Increment hit count (non-blocking)
    sb.from('quest_cache').update({ hit_count: cached.hit_count + 1 }).eq('cache_key', cacheKey).then(() => {});
    return new Response(JSON.stringify({ quests: cached.quest_json }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Generate via LLM ──
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ quests: _getTemplateQuests() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const prompt = _buildPrompt(levelReached);

  try {
    const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const llmData = await llmRes.json();
    const rawText: string = llmData.content?.[0]?.text ?? '';
    let quests: unknown[] = [];

    try {
      const parsed = JSON.parse(rawText);
      quests = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      quests = _getTemplateQuests();
    }

    // ── Store in cache ──
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
    await sb.from('quest_cache').upsert({
      cache_key: cacheKey,
      quest_json: quests,
      hit_count: 0,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    return new Response(JSON.stringify({ quests }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[generate-quests] LLM call failed:', err);
    return new Response(JSON.stringify({ quests: _getTemplateQuests() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function _buildPrompt(levelReached: number): string {
  const difficulty = levelReached < 5 ? 'easy' : levelReached < 15 ? 'medium' : 'hard';
  return `You are a quest designer for "The Living Blueprint: Glass Greenhouse Estate", a bio-architect physics match-3 game.
Generate a JSON array of exactly 3 quest objects for a ${difficulty} level player (level ${levelReached}).
Each quest must follow this exact JSON shape:
{"id":"quest_XXXXXX","name":"Short Title","flavorText":"1-2 sentences in bio-architect voice.","objectives":[{"id":"obj_XXXX","type":"match_count|match_category|score_target","target":NUMBER,"category":"structural|organic|hybrid","label":"Player text"}],"rewardMultiplier":1.0-2.5,"generatedBy":"llm"}
Output ONLY valid JSON array, no markdown, no explanation.`;
}

function _getTemplateQuests() {
  return [
    { id: 'quest_templ1', name: 'Blueprint Harvest', flavorText: 'Match structural elements to begin construction.', objectives: [{ id: 'obj_t1', type: 'match_count', target: 10, label: 'Make 10 Matches' }], rewardMultiplier: 1.2, generatedBy: 'template' },
    { id: 'quest_templ2', name: 'Overgrowth Protocol', flavorText: 'Let vines reclaim the scaffold.', objectives: [{ id: 'obj_t2', type: 'match_category', target: 8, category: 'organic', label: 'Match 8 Organic' }], rewardMultiplier: 1.5, generatedBy: 'template' },
    { id: 'quest_templ3', name: 'Bio-Steel Synthesis', flavorText: 'Merge the living and built worlds.', objectives: [{ id: 'obj_t3', type: 'score_target', target: 5000, label: 'Score 5,000 Points' }], rewardMultiplier: 1.8, generatedBy: 'template' },
  ];
}
