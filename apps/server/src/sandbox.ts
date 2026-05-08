// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import { Router } from 'express';
import { runMonteCarlo } from '@match3d/farkle-engine';
import type { GameMode } from '@match3d/farkle-shared';
import { MULTIPLIER_LADDER } from '@match3d/farkle-shared';

const router = Router();

function buildMultiplierDistribution(farkleRate: number): Record<string, number> {
  const steps = MULTIPLIER_LADDER.length;
  const dist: Record<string, number> = {};
  const keys = ['x1_0', 'x1_25', 'x1_5', 'x2_0', 'x3_0', 'x4_0'];
  let remaining = 1;
  for (let i = 0; i < steps; i++) {
    const pStop = i < steps - 1 ? remaining * farkleRate : remaining;
    dist[keys[i]] = Number(pStop.toFixed(4));
    remaining *= (1 - farkleRate);
  }
  return dist;
}

function applyWeightBias(baseScore: number, weights: Record<string, number>): number {
  const highValueBias = (weights['face_1'] ?? 0) * 0.6 + (weights['face_5'] ?? 0) * 0.3;
  const lowValueBias = (['face_2', 'face_3', 'face_4', 'face_6'] as const)
    .reduce((sum, k) => sum + (weights[k] ?? 0) * 0.1, 0);
  return Math.round(baseScore * (1 + highValueBias + lowValueBias));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runMonteCarloSimulation(patch: any, sessions: number) {
  const mode: GameMode = (patch?.rtp_impact?.mode as GameMode) ?? 'SOLO_FREE';
  const weights: Record<string, number> = patch?.rtp_impact?.spawn_weight_adjustments ?? {};

  const result = runMonteCarlo(mode, sessions);
  const biasedScore = applyWeightBias(result.averageScore, weights);

  return {
    avgScore: biasedScore,
    farkleRate: Number(result.farkleRate.toFixed(3)),
    multiplierDistribution: buildMultiplierDistribution(result.farkleRate),
    sessionsRun: result.sessionsRun,
  };
}

async function analyzeRTPImpact(input: {
  patchName: string;
  patchDescription: string;
  baselineRTP: number;
  simulationResults: { avgScore: number; farkleRate: number; sessionsRun: number };
  spawnWeightAdjustments: Record<string, number>;
}): Promise<{
  analysis: string;
  recommendations: string[];
  projectedRTP: number;
  projectedRTPRange: [number, number];
  riskLevel: 'low' | 'medium' | 'high';
  approved: boolean;
}> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `You are an RTP analyst for a dice game called Farkle Frenzy.

Patch: ${input.patchName}
Description: ${input.patchDescription}
Baseline RTP: ${(input.baselineRTP * 100).toFixed(1)}%
Simulation sessions: ${input.simulationResults.sessionsRun}
Avg score with patch: ${input.simulationResults.avgScore}
Farkle rate with patch: ${(input.simulationResults.farkleRate * 100).toFixed(1)}%
Spawn weight adjustments: ${JSON.stringify(input.spawnWeightAdjustments)}

Respond ONLY with a JSON object in this exact shape:
{
  "analysis": "<2-3 sentence plain English analysis>",
  "recommendations": ["<rec1>", "<rec2>"],
  "projectedRTP": <number between 0 and 1>,
  "projectedRTPRange": [<low>, <high>],
  "riskLevel": "<low|medium|high>",
  "approved": <true|false>
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any;
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (json) return JSON.parse(json);
    } catch (e) {
      console.error('Gemini analysis failed, falling back to deterministic:', e);
    }
  }

  const { avgScore, farkleRate, sessionsRun } = input.simulationResults;
  const BASE_SCORE = 4500;
  const projectedRTP = Number(((avgScore / BASE_SCORE) * 0.92).toFixed(4));
  const margin = farkleRate * 0.05;
  const projectedRTPRange: [number, number] = [
    Number((projectedRTP - margin).toFixed(4)),
    Number((projectedRTP + margin).toFixed(4)),
  ];

  const rtpDelta = projectedRTP - input.baselineRTP;
  const riskLevel: 'low' | 'medium' | 'high' =
    Math.abs(rtpDelta) < 0.02 ? 'low' : Math.abs(rtpDelta) < 0.05 ? 'medium' : 'high';
  const approved = projectedRTP >= 0.88 && projectedRTP <= 1.05;

  const weights = input.spawnWeightAdjustments;
  const face1Shift = weights['face_1'] ?? 0;
  const face5Shift = weights['face_5'] ?? 0;

  const recs: string[] = [];
  if (face1Shift > 0.05) recs.push('High face-1 weight bias increases avg score — monitor for payout creep.');
  if (face5Shift > 0.05) recs.push('Elevated face-5 weight adds moderate score uplift — acceptable if RTP stays under 1.0.');
  if (farkleRate > 0.2) recs.push('Farkle rate above 20% — consider tuning blocker density to reduce frustration.');
  if (!approved) recs.push('Projected RTP outside approved band [0.88–1.05] — do not ship without further tuning.');
  if (recs.length === 0) recs.push(`Patch looks balanced across ${sessionsRun} sessions. Approved for staging.`);

  return {
    analysis: `Patch "${input.patchName}" projects an RTP of ${(projectedRTP * 100).toFixed(1)}% against a baseline of ${(input.baselineRTP * 100).toFixed(1)}% over ${sessionsRun} simulated sessions. Farkle rate is ${(farkleRate * 100).toFixed(1)}%, and the patch is ${approved ? 'within' : 'outside'} the approved RTP band.`,
    recommendations: recs,
    projectedRTP,
    projectedRTPRange,
    riskLevel,
    approved,
  };
}

router.post('/simulate', async (req, res) => {
  try {
    const { patch, sessions = 4000 } = req.body;
    if (!patch) return res.status(400).json({ error: 'Patch data is required' });
    const results = await runMonteCarloSimulation(patch, sessions);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: 'Analysis input is required' });
    const analysis = await analyzeRTPImpact(input);
    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

router.get('/health', (req, res) => {
  res.json({ ok: true, aiAvailable: !!process.env.GEMINI_API_KEY });
});

export const sandboxRouter = router;
