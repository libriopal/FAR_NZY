import { nanoid } from 'nanoid';
import { authorization } from '../governance/authorization.js';
import { complianceGuard } from '../governance/complianceGuard.js';
import { budgetGuard } from '../governance/budgetGuard.js';
import { policyEngine } from '../governance/policyEngine.js';
import { aiGateway } from '../gateway/aiGateway.js';
import { spendTracker } from '../spend/spendTracker.js';
import { SpendCategory } from '../spend/budgetManager.js';
import { auditExporter } from '../audit/auditExporter.js';
import { AI_CONFIG } from '../config.js';

// Local interface matching the output shape of runMonteCarlo() — never import from sacred files.
// Shape: { averageScore, farkleRate, normalizer, sessionsRun }
export interface MonteCarloResult {
  averageScore: number;
  farkleRate:   number;
  normalizer:   number;
  sessionsRun:  number;
}

// Cohere pricing estimate for command-r-08-2024
const INPUT_TOKEN_COST  = 0.000_000_150;
const OUTPUT_TOKEN_COST = 0.000_000_600;

function shouldEscalate(result: MonteCarloResult, baselineRTP: number): boolean {
  if (!AI_CONFIG.mcEscalationEnabled) return false;
  const projectedRTP = result.averageScore / result.normalizer;
  const rtpDelta = Math.abs(projectedRTP - baselineRTP);
  return (
    rtpDelta > AI_CONFIG.mcRtpDeltaThreshold ||
    result.farkleRate > AI_CONFIG.mcFarkleMax   ||
    result.farkleRate < AI_CONFIG.mcFarkleMin
  );
}

function deterministicAnalysis(result: MonteCarloResult, baselineRTP: number): string {
  const projectedRTP = result.averageScore / result.normalizer;
  const rtpDelta = projectedRTP - baselineRTP;
  return `DETERMINISTIC_PATH: Monte Carlo result is within normal bounds. Projected RTP ${(projectedRTP * 100).toFixed(2)}% vs baseline ${(baselineRTP * 100).toFixed(2)}% (delta ${(rtpDelta * 100).toFixed(2)}%). Farkle rate ${(result.farkleRate * 100).toFixed(2)}% within expected range [${(AI_CONFIG.mcFarkleMin * 100).toFixed(0)}%–${(AI_CONFIG.mcFarkleMax * 100).toFixed(0)}%]. No AI escalation required.`;
}

export async function analyze(result: MonteCarloResult, baselineRTP: number): Promise<string> {
  if (!shouldEscalate(result, baselineRTP)) {
    process.stdout.write('[monteCarloAuditor] DETERMINISTIC_PATH — no escalation\n');
    return deterministicAnalysis(result, baselineRTP);
  }

  process.stdout.write('[monteCarloAuditor] ESCALATED_PATH — anomaly detected, calling Cohere\n');

  // Governance chain
  authorization.authorize('monte-carlo');
  complianceGuard.checkCompliance();
  budgetGuard.enforceBudget(SpendCategory.MONTE_CARLO);

  const projectedRTP = result.averageScore / result.normalizer;

  const prompt = `You are a Monte Carlo RTP compliance analyst for Farkle Frenzy, a skill-based sweepstakes dice game.
An ANOMALY was detected in Monte Carlo simulation results — your analysis is required.
Your role is to ANALYZE and RECOMMEND only. You do NOT set RTP values or make compliance decisions.

Simulation results:
- Sessions run: ${result.sessionsRun}
- Average score: ${result.averageScore.toFixed(2)}
- Farkle rate: ${(result.farkleRate * 100).toFixed(2)}%
- Normalizer: ${result.normalizer.toFixed(4)}
- Projected RTP: ${(projectedRTP * 100).toFixed(2)}%
- Baseline RTP: ${(baselineRTP * 100).toFixed(2)}%
- RTP delta: ${(Math.abs(projectedRTP - baselineRTP) * 100).toFixed(2)}%

Anomaly trigger: ${result.farkleRate > AI_CONFIG.mcFarkleMax ? `Farkle rate ${(result.farkleRate * 100).toFixed(2)}% exceeds maximum ${(AI_CONFIG.mcFarkleMax * 100).toFixed(0)}%` : result.farkleRate < AI_CONFIG.mcFarkleMin ? `Farkle rate ${(result.farkleRate * 100).toFixed(2)}% below minimum ${(AI_CONFIG.mcFarkleMin * 100).toFixed(0)}%` : `RTP delta ${(Math.abs(projectedRTP - baselineRTP) * 100).toFixed(2)}% exceeds threshold ${(AI_CONFIG.mcRtpDeltaThreshold * 100).toFixed(0)}%`}

Provide a 2-3 sentence analysis explaining the anomaly and recommended next steps for the engineering team.`;

  const response = await aiGateway.generate({
    prompt,
    model: AI_CONFIG.rtpModel,
    maxTokens: 512,
    temperature: 0.2,
  });

  policyEngine.validateResponse(response.text);

  spendTracker.recordCall({
    category: SpendCategory.MONTE_CARLO,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    estimatedCostUsd:
      response.inputTokens * INPUT_TOKEN_COST +
      response.outputTokens * OUTPUT_TOKEN_COST,
    timestamp: new Date().toISOString(),
  });

  auditExporter.export({
    schemaVersion: '1.0',
    id: nanoid(),
    timestamp: new Date().toISOString(),
    auditType: 'monte-carlo',
    tags: ['rtp', 'monte-carlo', 'anomaly'],
    proposal: { result, baselineRTP },
    analysis: response.text,
    recommendations: [],
    riskLevel: Math.abs(projectedRTP - baselineRTP) > 0.05 ? 'high' : 'medium',
  });

  return `ESCALATED_PATH: ${response.text}`;
}

export const monteCarloAuditor = { analyze };
