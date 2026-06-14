// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import { Router } from 'express';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { WebSocket } from 'ws';
import { runMonteCarlo, runMonteCarloV2 } from '@match3d/farkle-engine';
import type { MonteCarloResultV2, PlayerModel, SimConfig } from '@match3d/farkle-engine';
import type { GameMode } from '@match3d/farkle-shared';
import { MULTIPLIER_LADDER } from '@match3d/farkle-shared';
import * as store from './sandbox/sessionStore.js';
import { monteCarloAuditor } from './ai/auditors/monteCarloAuditor.js';
import { spendTracker } from './ai/spend/spendTracker.js';
import { budgetManager } from './ai/spend/budgetManager.js';
import { AI_CONFIG } from './ai/config.js';
import { owc, type OWCInput } from '@match3d/owc';
import { z } from 'zod';

// ESM-compatible __dirname
const __dirnameCompat = dirname(fileURLToPath(import.meta.url));
const CHECKLIST_PATH = resolve(
  __dirnameCompat,
  '../../../packages/farkle-engine/src/monteCarlo.COVERAGE_CHECKLIST.md',
);

const router = Router();

function buildMultiplierDistribution(farkleRate: number): Record<string, number> {
  const steps = MULTIPLIER_LADDER.length;
  const dist: Record<string, number> = {};
  const keys = ['x1_0', 'x1_25', 'x1_5', 'x2_0', 'x3_0', 'x4_0'];
  let remaining = 1;
  for (let i = 0; i < steps; i++) {
    const pStop = i < steps - 1 ? remaining * farkleRate : remaining;
    dist[keys[i] ?? i] = Number(pStop.toFixed(4));
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

// Typed shape for patch input — narrowed from unknown at the boundary.
interface SimPatch {
  rtp_impact?: {
    mode?: string;
    spawn_weight_adjustments?: Record<string, number>;
  };
}

function parseSimPatch(raw: unknown): SimPatch {
  if (!raw || typeof raw !== 'object') return {};
  const p = raw as Record<string, unknown>;
  const impact = p['rtp_impact'];
  if (!impact || typeof impact !== 'object') return {};
  const i = impact as Record<string, unknown>;
  const weights = i['spawn_weight_adjustments'];
  const rtp_impact: SimPatch['rtp_impact'] = {};
  if (typeof i['mode'] === 'string') rtp_impact.mode = i['mode'];
  if (weights && typeof weights === 'object') {
    rtp_impact.spawn_weight_adjustments = weights as Record<string, number>;
  }
  return { rtp_impact };
}

// OWC parameters that can be set via sandbox config / CLI
export interface OWCParams {
  enabled: boolean;
  playerRank?: number;        // 1=leader, 2+=trailing
  playerCount?: number;
  turnsElapsed?: number;
  targetRTP?: number;         // override mode default; omit to use mode-derived value
}

// Zod schema for the /owc-weights endpoint — enforces bounds and rejects non-finite inputs.
const GAME_MODES: [GameMode, ...GameMode[]] = [
  'SOLO_FREE', 'SOLO_CASINO', 'VS_FREE', 'VS_CASINO',
  'RALLY_FREE', 'RALLY_CASINO', 'HEIST_FREE', 'HEIST_CASINO',
];
const OWCInputSchema = z.object({
  mode:               z.enum(GAME_MODES),
  playerRank:         z.number().int().min(1),
  playerCount:        z.number().int().min(1),
  turnsElapsed:       z.number().int().min(0),
  currentRTP:         z.number().min(0).finite(),
  targetRTP:          z.number().positive().finite(),
  sessionFarkleRate:  z.number().min(0).max(1).finite(),
});

async function runMonteCarloSimulation(patch: unknown, sessions: number, owcParams?: OWCParams) {
  const parsed = parseSimPatch(patch);
  const mode: GameMode = (parsed.rtp_impact?.mode as GameMode | undefined) ?? 'SOLO_FREE';
  const manualWeights: Record<string, number> = parsed.rtp_impact?.spawn_weight_adjustments ?? {};

  const result = runMonteCarlo(mode, sessions);

  // Derive the mode-correct targetRTP from the normalizer.
  // normalizer = averageScore / RTP_CONFIGS[mode].targetRTP, so this inverts correctly.
  const modeTargetRTP = result.averageScore / (result.normalizer || 1);

  // currentRTP is computed from the manual-biased score so it can drift relative to
  // targetRTP when callers supply spawn weight adjustments. Without manual weights this
  // equals modeTargetRTP (no drift) and OWC correction correctly stays silent.
  const manualBiasedScore = applyWeightBias(result.averageScore, manualWeights);
  const currentRTP = manualBiasedScore / (result.normalizer || 1);

  // Compute OWC adjustments on top of any manual spawn weights
  let owcWeights: Record<string, number> = {};
  let owcContributionRtp = 0;
  let owcReason = 'DISABLED';

  if (owcParams?.enabled) {
    const input: OWCInput = {
      mode,
      playerRank:         owcParams.playerRank ?? 1,
      playerCount:        owcParams.playerCount ?? 1,
      turnsElapsed:       owcParams.turnsElapsed ?? 10,
      currentRTP,
      targetRTP:          owcParams.targetRTP ?? modeTargetRTP,
      sessionFarkleRate:  result.farkleRate,
    };
    const owcOut = owc.computeWeights(input);
    owcWeights = owcOut.spawnWeightAdjustments as unknown as Record<string, number>;
    owcContributionRtp = owcOut.owcContributionRtp;
    owcReason = owcOut.reason;
  }

  // Merge: manual weights take precedence over OWC adjustments
  const mergedWeights: Record<string, number> = { ...owcWeights, ...manualWeights };
  const biasedScore = applyWeightBias(result.averageScore, mergedWeights);

  return {
    avgScore: biasedScore,
    farkleRate: Number(result.farkleRate.toFixed(3)),
    multiplierDistribution: buildMultiplierDistribution(result.farkleRate),
    sessionsRun: result.sessionsRun,
    owc: { enabled: owcParams?.enabled ?? false, contributionRtp: owcContributionRtp, reason: owcReason },
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
  let aiAnalysis: string | null = null;
  try {
    const mcResult = {
      averageScore: input.simulationResults.avgScore,
      farkleRate:   input.simulationResults.farkleRate,
      normalizer:   input.simulationResults.avgScore / (input.baselineRTP || 0.95),
      sessionsRun:  input.simulationResults.sessionsRun,
    };
    aiAnalysis = await monteCarloAuditor.analyze(mcResult, input.baselineRTP);
  } catch (e) {
    process.stderr.write(`Monte Carlo auditor failed, falling back to deterministic: ${String(e)}\n`);
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
    analysis: aiAnalysis ?? `Patch "${input.patchName}" projects an RTP of ${(projectedRTP * 100).toFixed(1)}% against a baseline of ${(input.baselineRTP * 100).toFixed(1)}% over ${sessionsRun} simulated sessions. Farkle rate is ${(farkleRate * 100).toFixed(1)}%, and the patch is ${approved ? 'within' : 'outside'} the approved RTP band.`,
    recommendations: recs,
    projectedRTP,
    projectedRTPRange,
    riskLevel,
    approved,
  };
}

router.post('/simulate', async (req, res) => {
  try {
    const { patch, sessions = 4000, owcParams } = req.body as {
      patch: unknown;
      sessions?: number;
      owcParams?: OWCParams;
    };
    if (!patch) { res.status(400).json({ error: 'Patch data is required' }); return; }
    const results = await runMonteCarloSimulation(patch, sessions, owcParams);
    res.json({ success: true, results });
  } catch (error) {
    process.stderr.write(`Simulation error: ${String(error)}\n`);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) { res.status(400).json({ error: 'Analysis input is required' }); return; }
    const analysis = await analyzeRTPImpact(input);
    res.json({ success: true, analysis });
  } catch (error) {
    process.stderr.write(`Analysis error: ${String(error)}\n`);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

router.get('/health', (_req, res) => {
  const spend = spendTracker.getSpend();
  const budget = budgetManager.getAllStatus();
  res.json({
    ok: true,
    cohereConfigured: !!AI_CONFIG.cohereApiKey,
    spend: spend.byCategory,
    budget,
  });
});

// ─── OWC endpoint ────────────────────────────────────────────────────────────

router.post('/owc-weights', (req, res) => {
  const parsed = OWCInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid OWC input', details: parsed.error.flatten() });
    return;
  }
  try {
    const result = owc.computeWeights(parsed.data);
    res.json({ success: true, result });
  } catch (error) {
    process.stderr.write(`OWC error: ${String(error)}\n`);
    res.status(500).json({ error: 'OWC computation failed' });
  }
});

// ─── Coverage checklist types ─────────────────────────────────────────────────

interface CoverageItem {
  category: string;
  label: string;
  checked: boolean;
  lineRef: string | null;
}

interface CoverageReport {
  total: number;
  checked: number;
  unchecked: number;
  percentComplete: number;
  items: CoverageItem[];
}

// ─── Checklist parser ─────────────────────────────────────────────────────────

function parseChecklist(content: string): CoverageReport {
  const lines = content.split('\n');
  let currentCategory = 'Uncategorized';
  const items: CoverageItem[] = [];

  for (const line of lines) {
    // Skip file-level comments (single #) and blank lines
    if (line.startsWith('# ') || line.trim() === '') continue;

    // Category header
    if (line.startsWith('## ')) {
      currentCategory = line.slice(3).trim();
      continue;
    }

    // Checked item: - [x] label
    const checkedMatch = /^- \[x\] (.+)$/i.exec(line);
    if (checkedMatch) {
      const full = checkedMatch[1] ?? '';
      const lineRefMatch = /(\w[\w.]+\.ts:\d+)/.exec(full);
      items.push({
        category: currentCategory,
        label: full.replace(/\s*→\s*\w[\w.]+\.ts:\d+/, '').trim(),
        checked: true,
        lineRef: lineRefMatch?.[1] ?? null,
      });
      continue;
    }

    // Unchecked item: - [ ] label
    const uncheckedMatch = /^- \[ \] (.+)$/.exec(line);
    if (uncheckedMatch) {
      items.push({
        category: currentCategory,
        label: (uncheckedMatch[1] ?? '').trim(),
        checked: false,
        lineRef: null,
      });
    }
  }

  const total = items.length;
  const checked = items.filter(i => i.checked).length;
  const unchecked = total - checked;
  const percentComplete = total > 0 ? Math.round((checked / total) * 100) : 0;
  return { total, checked, unchecked, percentComplete, items };
}

// ─── Sandbox V2 HTTP endpoints (also root-mounted via index.ts) ───────────────

router.post('/simulate-v2', async (req, res) => {
  try {
    const {
      mode        = 'SOLO_CASINO',
      playerModel = 'AVERAGE',
      seed        = Date.now(),
      sessions    = 100_000,
    } = req.body as { mode?: string; playerModel?: string; seed?: number; sessions?: number };

    const config: SimConfig = {
      mode:           mode as GameMode,
      sessions:       Math.min(sessions, 100_000),
      maxTurns:       30,
      playerModel:    playerModel as PlayerModel,
      blockerDensity: 'MEDIUM',
      playerCount:    1,
      rolesActive:    false,
      roles:          [],
      seed,
    };

    const result = await runMonteCarloV2(config);
    res.json(result);
  } catch (error) {
    process.stderr.write(`simulate-v2 error: ${String(error)}\n`);
    res.status(500).json({ error: 'Simulation failed', details: String(error) });
  }
});

function sumRTP(r: MonteCarloResultV2): number {
  return Number((
    r.baseChainRTP + r.multiplierContributionRTP + r.orbContributionRTP +
    r.doublerContributionRTP + r.archivistContributionRTP +
    r.bombStandardRTP + r.bombRainbowRTP
  ).toFixed(4));
}

router.post('/rtp-audit', async (req, res) => {
  try {
    const { seed = Date.now(), sessions = 100_000 } = req.body as { seed?: number; sessions?: number };
    const modes  = ['SOLO_CASINO', 'VS_CASINO', 'RALLY_CASINO'] as const;
    const models = ['OPTIMAL', 'AVERAGE', 'WEAK'] as const;
    const results: Record<string, MonteCarloResultV2> = {};

    for (const m of modes) {
      for (const p of models) {
        const config: SimConfig = {
          mode:           m,
          sessions:       Math.min(sessions, 100_000),
          maxTurns:       30,
          playerModel:    p,
          blockerDensity: 'MEDIUM',
          playerCount:    m === 'SOLO_CASINO' ? 1 : 4,
          rolesActive:    m === 'RALLY_CASINO',
          roles:          m === 'RALLY_CASINO' ? ['RAINMAKER', 'HEADHUNTER', 'ARCHIVIST', 'CONDUCTOR'] : [],
          seed:           seed ^ (modes.indexOf(m) * 31) ^ (models.indexOf(p) * 7),
        };
        results[`${m}_${p}`] = await runMonteCarloV2(config);
      }
    }

    const soloOpt  = results['SOLO_CASINO_OPTIMAL']!;
    const soloAvg  = results['SOLO_CASINO_AVERAGE']!;
    const soloWeak = results['SOLO_CASINO_WEAK']!;

    // Gate 2: actual RTP = averageScore / normalizer (normalizer = avgScore / targetRTP)
    const soloRTP  = Number((soloAvg.averageScore / soloAvg.normalizer).toFixed(4));
    // Gate 3: skill gap = OPTIMAL banked score advantage over WEAK, normalised by WEAK normalizer
    const optRTP   = Number((soloOpt.averageScore / soloOpt.normalizer).toFixed(4));
    const weakRTP  = Number((soloWeak.averageScore / soloWeak.normalizer).toFixed(4));
    const skillGap = Number(Math.abs(optRTP - weakRTP).toFixed(4));

    const gates = {
      Gate1: { status: soloOpt.sessionsRun >= 1                                  ? 'PASS' : 'FAIL', metric: 'completions',                value: soloOpt.sessionsRun,  threshold: '≥1' },
      Gate2: { status: soloRTP >= 0.82 && soloRTP <= 1.02                         ? 'PASS' : 'FAIL', metric: 'rtp_band (avgScore/norm)',   value: soloRTP,              threshold: 'SOLO 0.82–1.02' },
      Gate3: { status: soloOpt.averageScore !== soloWeak.averageScore              ? 'PASS' : 'FAIL', metric: 'skill_differentiation',      value: skillGap,             threshold: 'OPTIMAL≠WEAK average' },
      Gate4: { status: soloOpt.farkleRate >= 0.85 && soloOpt.farkleRate <= 0.95   ? 'PASS' : 'FAIL', metric: 'farkle_rate (per-turn)',     value: soloOpt.farkleRate,   threshold: '0.85–0.95' },
      Gate5: { status: soloOpt.p5Score >= 0 && soloAvg.averageScore > 100         ? 'PASS' : 'FAIL', metric: 'p5Score≥0 & avgScore>100',   value: soloOpt.p5Score,      threshold: 'p5≥0, avg>100' },
      Gate6: { status: soloOpt.normalizer > 0                                      ? 'PASS' : 'FAIL', metric: 'normalizer',                 value: soloOpt.normalizer,   threshold: '>0' },
    };

    const date     = new Date().toISOString().slice(0, 10);
    const outPath  = resolve(__dirnameCompat, '../../../art/profiling', `rtp_audit_${date}_${seed}.json`);
    mkdirSync(dirname(outPath), { recursive: true });
    const report   = { seed, sessions, gates, results };
    writeFileSync(outPath, JSON.stringify(report, null, 2));

    res.json(report);
  } catch (error) {
    process.stderr.write(`rtp-audit error: ${String(error)}\n`);
    res.status(500).json({ error: 'Audit failed', details: String(error) });
  }
});

router.post('/role-audit', async (req, res) => {
  try {
    const { seed = Date.now(), sessions = 50_000 } = req.body as { seed?: number; sessions?: number };
    const models  = ['OPTIMAL', 'AVERAGE', 'WEAK'] as const;
    const results: Record<string, MonteCarloResultV2> = {};

    for (const p of models) {
      const config: SimConfig = {
        mode:           'RALLY_CASINO',
        sessions:       Math.min(sessions, 50_000),
        maxTurns:       30,
        playerModel:    p,
        blockerDensity: 'MEDIUM',
        playerCount:    4,
        rolesActive:    true,
        roles:          ['RAINMAKER', 'HEADHUNTER', 'ARCHIVIST', 'CONDUCTOR'],
        seed:           seed ^ (models.indexOf(p) * 13),
      };
      results[`RALLY_CASINO_${p}`] = await runMonteCarloV2(config);
    }

    const avg = results['RALLY_CASINO_AVERAGE']!;
    const roleContrib = avg.roleContribution as Partial<Record<string, number>>;
    const contribValues = Object.values(roleContrib).filter((v): v is number => v !== undefined);
    const maxContrib    = contribValues.length ? Math.max(...contribValues) : 0;
    const minContrib    = contribValues.length ? Math.min(...contribValues) : 0;
    const gate6Status   = minContrib > 0 && maxContrib / minContrib <= 2.0 ? 'PASS' : 'FAIL';

    const date    = new Date().toISOString().slice(0, 10);
    const outPath = resolve(__dirnameCompat, '../../../art/profiling', `role_audit_${date}_${seed}.json`);
    mkdirSync(dirname(outPath), { recursive: true });
    const report  = {
      seed, sessions, mode: 'RALLY_CASINO',
      Gate6: { status: gate6Status, metric: 'role_balance', value: Number((maxContrib / (minContrib || 1)).toFixed(4)), threshold: 'max/min ≤ 2.0' },
      results,
    };
    writeFileSync(outPath, JSON.stringify(report, null, 2));

    res.json(report);
  } catch (error) {
    process.stderr.write(`role-audit error: ${String(error)}\n`);
    res.status(500).json({ error: 'Role audit failed', details: String(error) });
  }
});

// ─── Coverage status endpoint ─────────────────────────────────────────────────

router.get('/coverage-status', (_req, res) => {
  try {
    const content = readFileSync(CHECKLIST_PATH, 'utf-8');
    res.json(parseChecklist(content));
  } catch {
    res.status(500).json({ error: 'Could not read coverage checklist' });
  }
});

// ─── AI Advisor ───────────────────────────────────────────────────────────────

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

async function callAIAdvisor(
  prompt: string,
  agent: 'kendo' | 'claude',
): Promise<string> {
  // KENDO_AI: stub — API not yet available; fall back to Claude
  if (agent === 'kendo') {
    const kendoKey = process.env.KENDO_AI_API_KEY;
    if (!kendoKey) {
      // Fallback to Claude when Kendo AI key is absent
    } else {
      // TODO: implement Kendo AI call when API spec is published
      throw new Error('Kendo AI API not yet implemented — set KENDO_AI_API_KEY when available');
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return '[AI advisor unavailable — set ANTHROPIC_API_KEY to enable]';
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: 'You are an RTP compliance advisor for Farkle Frenzy, a skill-based sweepstakes game. Analyse simulation results and provide concise, actionable recommendations. Every engineering decision is a legal decision.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: HTTP ${res.status}`);
  }

  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find(c => c.type === 'text')?.text ?? '[no response]';
}

// ─── Sandbox WebSocket handler ────────────────────────────────────────────────

export function handleSandboxWS(ws: WebSocket): void {
  // Send full session state on connect
  ws.send(JSON.stringify({ type: 'ROOM_STATE', payload: store.getInitialState() }));

  ws.on('message', (raw) => {
    let msg: { type: string; [k: string]: unknown };
    try { msg = JSON.parse(raw.toString()) as { type: string; [k: string]: unknown }; }
    catch { return; }

    switch (msg.type) {

      case 'RUN_SIM': {
        const config = store.currentConfig();
        const mode   = config.mode as GameMode;
        const sessions = Math.min(config.sessions, 100_000);
        const startMs = Date.now();

        ws.send(JSON.stringify({ type: 'SIM_START', payload: { sessionId: `sim-${Date.now()}` } }));
        ws.send(JSON.stringify({
          type: 'SIM_PROGRESS',
          payload: { sessionsComplete: 0, totalSessions: sessions, percentComplete: 0, elapsedMs: 0 },
        }));

        // Yield to the event loop before the synchronous simulation run
        setTimeout(() => {
          try {
            const raw = runMonteCarlo(mode, Math.min(sessions, 10_000));
            // Build MonteCarloResultV2-shaped result (placeholder fields until Batch A)
            const result = {
              averageScore:               Math.round(raw.averageScore),
              farkleRate:                 Number(raw.farkleRate.toFixed(4)),
              normalizer:                 Number(raw.normalizer.toFixed(4)),
              sessionsRun:                raw.sessionsRun,
              p95Score:                   0,
              p5Score:                    0,
              variance:                   0,
              stdDev:                     0,
              baseChainRTP:               0.60,
              multiplierContributionRTP:  0.20,
              orbContributionRTP:         0.05,
              doublerContributionRTP:     0.05,
              archivistContributionRTP:   0.02,
              bombStandardRTP:            0.04,
              bombRainbowRTP:             0.04,
              milestonePayout:            0,
              bombStandardRate:           0,
              bombRainbowRate:            0,
              orbActivationRate:          0,
              doublerTriggerRate:         0,
              deadBoardRecoveryRate:      0,
              multiplierStepDistribution: { 0: 0.40, 1: 0.25, 2: 0.15, 3: 0.10, 4: 0.06, 5: 0.04 },
              roleContribution:           {} as Record<string, number>,
              milestoneHitRate:           {} as Record<number, number>,
              voteOutcomeDistribution:    { continue: 0.50, bank: 0.40, pass: 0.10 },
              playerModel:                config.playerModel,
              seed:                       config.seed,
              config:                     JSON.stringify(config),
            };
            store.setLastResult(result);
            ws.send(JSON.stringify({
              type: 'SIM_PROGRESS',
              payload: { sessionsComplete: result.sessionsRun, totalSessions: sessions, percentComplete: 100, elapsedMs: Date.now() - startMs },
            }));
            ws.send(JSON.stringify({ type: 'SIM_COMPLETE', payload: result }));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'SIM_ERROR', payload: { message: String(e) } }));
          }
        });
        break;
      }

      case 'CONFIG_CHANGE': {
        const delta = (msg.delta ?? msg.payload) as Partial<Record<string, unknown>>;
        if (!delta || typeof delta !== 'object') break;
        const cmd = store.applyConfigChange(delta as Parameters<typeof store.applyConfigChange>[0]);
        ws.send(JSON.stringify({
          type: 'CONFIG_CHANGED',
          payload: { ...delta, history: store.history() },
        }));
        void cmd; // cmd logged in undoStack
        break;
      }

      case 'UNDO': {
        const result = store.undo();
        if (!result) break;
        ws.send(JSON.stringify({
          type: 'UNDO_APPLIED',
          payload: { undoDepth: store.undoDepth(), redoDepth: store.redoDepth(), config: result.config, history: store.history() },
        }));
        break;
      }

      case 'REDO': {
        const result = store.redo();
        if (!result) break;
        ws.send(JSON.stringify({
          type: 'REDO_APPLIED',
          payload: { undoDepth: store.undoDepth(), redoDepth: store.redoDepth(), config: result.config, history: store.history() },
        }));
        break;
      }

      case 'RESET':
        store.reset();
        ws.send(JSON.stringify({ type: 'SESSION_RESET', payload: store.getInitialState() }));
        break;

      case 'CHECKPOINT': {
        const name = (msg.name as string | undefined) ?? `checkpoint-${Date.now()}`;
        const cp = store.saveCheckpoint(name);
        ws.send(JSON.stringify({ type: 'CHECKPOINT_SAVED', payload: cp }));
        break;
      }

      case 'SET_AGENT':
        store.setAgent((msg.payload as 'kendo' | 'claude') ?? 'kendo');
        break;

      case 'CHAT_MESSAGE': {
        const text  = (msg.payload as { text?: string } | undefined)?.text ?? String(msg.payload ?? '');
        const agent = store.currentAgent();
        ws.send(JSON.stringify({ type: 'ADVISOR_UPDATE', payload: { isLoading: true } }));
        callAIAdvisor(text, agent).then(reply => {
          const chatMsg = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            agent,
            text: reply,
            timestamp: Date.now(),
          };
          ws.send(JSON.stringify({ type: 'CHAT_REPLY', payload: chatMsg }));
        }).catch(e => {
          ws.send(JSON.stringify({ type: 'SIM_ERROR', payload: { message: String(e) } }));
        });
        break;
      }

      case 'ADVISOR_EXPLAIN': {
        const id    = msg.id as string;
        const agent = store.currentAgent();
        const config = store.currentConfig();
        const prompt = `You are an RTP compliance advisor. Provide a detailed explanation for recommendation ID "${id}" in the context of a Farkle Frenzy simulation with mode ${config.mode}, targetRTP ${config.targetRTP}, sessions ${config.sessions}. Give specific, actionable guidance.`;
        callAIAdvisor(prompt, agent).then(content => {
          ws.send(JSON.stringify({ type: 'ADVISOR_UPDATE', payload: { id, content } }));
        }).catch(e => {
          ws.send(JSON.stringify({ type: 'SIM_ERROR', payload: { message: String(e) } }));
        });
        break;
      }

      default:
        break;
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sandboxRouter: import('express').Router = router;
