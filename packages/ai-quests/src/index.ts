// ─── LLM-Driven Quest Generation System ──────────────────────────────────────
// Caches LLM outputs server-side. Never blocks the gameplay loop.
// Edge function generates quests; client receives cached JSON.

import type { ObjectiveConfig } from '@match3d/game-core';

export interface QuestTheme {
  id: string;
  name: string;
  flavorText: string;
  objectives: ObjectiveConfig[];
  rewardMultiplier: number;
  expiresAt: number; // unix ms — quests have time limits
  personalizedFor?: string | undefined;
  generatedBy: 'llm' | 'template';
  cachedAt: number;
}

export interface QuestCacheEntry {
  key: string;
  quest: QuestTheme;
  hitCount: number;
  lastAccessed: number;
}

// ─── Client-side Quest Manager (reads from cache) ────────────────────────────

export class QuestManager {
  private activeQuests: QuestTheme[] = [];
  private fetchFn: ((userId: string) => Promise<QuestTheme[]>) | null = null;

  setFetchFunction(fn: typeof this.fetchFn): void {
    this.fetchFn = fn;
  }

  async loadQuestsForUser(userId: string): Promise<QuestTheme[]> {
    if (!this.fetchFn) {
      return this._getFallbackQuests();
    }
    try {
      const quests = await this.fetchFn(userId);
      this.activeQuests = quests.filter(q => q.expiresAt > Date.now());
      return this.activeQuests;
    } catch {
      return this._getFallbackQuests();
    }
  }

  getActiveQuests(): QuestTheme[] {
    return this.activeQuests.filter(q => q.expiresAt > Date.now());
  }

  private _getFallbackQuests(): QuestTheme[] {
    const now = Date.now();
    return TEMPLATE_QUESTS.map(t => ({
      ...t,
      cachedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
    }));
  }
}

// ─── Template Quest Bank (fallback when LLM unavailable) ─────────────────────

export const TEMPLATE_QUESTS: Omit<QuestTheme, 'cachedAt' | 'expiresAt'>[] = [
  {
    id: 'quest_structural_sprint',
    name: 'Blueprint Harvest',
    flavorText: 'The greenhouse needs a foundation. Match structural components to begin construction.',
    objectives: [
      {
        id: 'obj_struct_10',
        type: 'match_category',
        target: 10,
        category: 'structural',
        label: 'Match 10 Structural Items',
      },
    ],
    rewardMultiplier: 1.2,
    personalizedFor: undefined,
    generatedBy: 'template',
  },
  {
    id: 'quest_organic_bloom',
    name: 'Overgrowth Protocol',
    flavorText: 'Let the vines reclaim the scaffold. Clear organic chaos to reveal the living blueprint.',
    objectives: [
      {
        id: 'obj_organic_15',
        type: 'match_category',
        target: 15,
        category: 'organic',
        label: 'Match 15 Organic Items',
      },
      {
        id: 'obj_score_5000',
        type: 'score_target',
        target: 5000,
        label: 'Reach 5,000 Score',
      },
    ],
    rewardMultiplier: 1.5,
    personalizedFor: undefined,
    generatedBy: 'template',
  },
  {
    id: 'quest_hybrid_fusion',
    name: 'Bio-Steel Synthesis',
    flavorText: 'Merge the living and the built. Hybrid items carry the essence of both worlds.',
    objectives: [
      {
        id: 'obj_hybrid_8',
        type: 'match_category',
        target: 8,
        category: 'hybrid',
        label: 'Match 8 Hybrid Items',
      },
    ],
    rewardMultiplier: 1.8,
    personalizedFor: undefined,
    generatedBy: 'template',
  },
];

// ─── LLM Prompt Builder (for edge function use) ──────────────────────────────

export interface PlayerProgressContext {
  userId: string;
  levelReached: number;
  dominantCategory: 'structural' | 'organic' | 'hybrid';
  avgScore: number;
  recentFailureReason: 'overflow' | 'timeout' | null;
  purchasedUpgradeIds: string[];
}

export function buildQuestPrompt(ctx: PlayerProgressContext): string {
  return `You are a quest designer for a physics match-3 game called "The Living Blueprint: Glass Greenhouse Estate".
Theme: Bio-Architect (glass, marble, vines, bioluminescent flora).

Player profile:
- Level: ${ctx.levelReached}
- Favored style: ${ctx.dominantCategory} items
- Average score: ${ctx.avgScore}
- Recent failure: ${ctx.recentFailureReason ?? 'none'}
- Owned upgrades: ${ctx.purchasedUpgradeIds.join(', ') || 'none'}

Generate ONE quest JSON object with this exact shape:
{
  "id": "quest_<unique_6char_slug>",
  "name": "<evocative 2-4 word title>",
  "flavorText": "<1-2 sentences in Bio-Architect voice>",
  "objectives": [
    {
      "id": "obj_<slug>",
      "type": "match_count|match_category|match_specific|score_target",
      "target": <number>,
      "category": "structural|organic|hybrid (if match_category)",
      "label": "<player-facing description>"
    }
  ],
  "rewardMultiplier": <1.0-2.5 float>,
  "generatedBy": "llm"
}

Rules:
- Difficulty should match player level (level 1-5: easy, 6-15: medium, 16+: hard)
- If player keeps failing on overflow, generate a low-objective-count quest
- Use bio-architect terminology in names and flavor text
- Output ONLY valid JSON, no markdown, no explanation`;
}

export const questManager = new QuestManager();
