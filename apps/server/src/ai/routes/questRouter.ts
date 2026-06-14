import { Router } from 'express';
import { authorization } from '../governance/authorization.js';
import { budgetGuard } from '../governance/budgetGuard.js';
import { policyEngine } from '../governance/policyEngine.js';
import { aiGateway } from '../gateway/aiGateway.js';
import { spendTracker } from '../spend/spendTracker.js';
import { SpendCategory } from '../spend/budgetManager.js';
import { AI_CONFIG } from '../config.js';

const router = Router();

// Cohere pricing estimate for command-r7b-12-2024
const INPUT_TOKEN_COST  = 0.000_000_038;
const OUTPUT_TOKEN_COST = 0.000_000_075;

router.post('/batch', async (req, res) => {
  const { count = 10, themes = [] } = req.body as { count?: number; themes?: string[] };

  if (count > AI_CONFIG.questBatchMax) {
    return res.status(400).json({
      error: `count (${count}) exceeds QUEST_BATCH_MAX (${AI_CONFIG.questBatchMax})`,
      max: AI_CONFIG.questBatchMax,
    });
  }

  try {
    authorization.authorize('quest');
    budgetGuard.enforceBudget(SpendCategory.QUEST_GENERATION);

    const themeHint = themes.length > 0 ? `Focus on these themes: ${themes.join(', ')}.` : '';
    const prompt = `You are a quest designer for "The Living Blueprint: Glass Greenhouse Estate", a bio-architect physics match-3 game.
Generate a JSON array of exactly ${count} quest objects for varied difficulty levels.
${themeHint}
Each quest must follow this exact JSON shape:
{"id":"quest_XXXXXX","name":"Short Title","flavorText":"1-2 sentences in bio-architect voice.","objectives":[{"id":"obj_XXXX","type":"match_count|match_category|score_target","target":NUMBER,"category":"structural|organic|hybrid","label":"Player text"}],"rewardMultiplier":1.0-2.5,"generatedBy":"llm"}
Output ONLY valid JSON array, no markdown, no explanation.`;

    const response = await aiGateway.generate({
      prompt,
      model: AI_CONFIG.questModel,
      maxTokens: Math.min(count * 200, 4096),
      temperature: 0.7,
    });

    policyEngine.validateResponse(response.text);

    spendTracker.recordCall({
      category: SpendCategory.QUEST_GENERATION,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      estimatedCostUsd:
        response.inputTokens * INPUT_TOKEN_COST +
        response.outputTokens * OUTPUT_TOKEN_COST,
      timestamp: new Date().toISOString(),
    });

    let quests: unknown[] = [];
    try {
      const json = response.text.match(/\[[\s\S]*\]/)?.[0];
      if (json) quests = JSON.parse(json) as unknown[];
    } catch {
      return res.status(500).json({ error: 'Failed to parse quest batch from AI response' });
    }

    return res.json({ success: true, count: quests.length, quests });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

export { router as questRouter };
