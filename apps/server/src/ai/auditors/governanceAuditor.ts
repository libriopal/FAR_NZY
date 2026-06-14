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
import type { RTPProposal, GovernanceAuditResult } from '../governance/governanceSchemas.js';
import { validateRTPProposal } from '../governance/governanceSchemas.js';

// Cohere pricing estimate for command-r-08-2024 (USD per token)
const INPUT_TOKEN_COST  = 0.000_000_150;
const OUTPUT_TOKEN_COST = 0.000_000_600;

export async function analyze(rawInput: unknown): Promise<GovernanceAuditResult> {
  const proposal = validateRTPProposal(rawInput);

  // 1. Authorize
  authorization.authorize('governance');

  // 2. Compliance check (no user state context at governance level)
  complianceGuard.checkCompliance();

  // 3. Budget check
  budgetGuard.enforceBudget(SpendCategory.GOVERNANCE);

  // 4. Build prompt
  const prompt = buildGovernancePrompt(proposal);

  // 5. Call gateway
  const response = await aiGateway.generate({
    prompt,
    model: AI_CONFIG.rtpModel,
    maxTokens: 1024,
    temperature: 0.2,
    metadata: { auditType: 'governance', patchName: proposal.patchName },
  });

  // 6. Post-validate response
  policyEngine.validateResponse(response.text);

  // 7. Parse response
  const result = parseGovernanceResponse(response.text, proposal);

  // 8. Record spend
  spendTracker.recordCall({
    category: SpendCategory.GOVERNANCE,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    estimatedCostUsd:
      response.inputTokens * INPUT_TOKEN_COST +
      response.outputTokens * OUTPUT_TOKEN_COST,
    timestamp: new Date().toISOString(),
  });

  // 9. Export audit artifact
  auditExporter.export({
    schemaVersion: '1.0',
    id: nanoid(),
    timestamp: new Date().toISOString(),
    auditType: 'governance',
    tags: ['rtp', proposal.patchName],
    proposal,
    analysis: result.analysis,
    recommendations: result.recommendations,
    riskLevel: result.riskLevel,
  });

  return result;
}

function buildGovernancePrompt(p: RTPProposal): string {
  return `You are an RTP governance auditor for Farkle Frenzy, a skill-based sweepstakes dice game.
Your role is to ANALYZE and RECOMMEND only. You do NOT determine outcomes, set RTP values, or make compliance decisions.

Patch: ${p.patchName}
Description: ${p.patchDescription}
Baseline RTP: ${(p.baselineRTP * 100).toFixed(1)}%
Simulation sessions: ${p.simulationResults.sessionsRun}
Avg score with patch: ${p.simulationResults.avgScore}
Farkle rate with patch: ${(p.simulationResults.farkleRate * 100).toFixed(1)}%
Spawn weight adjustments: ${JSON.stringify(p.spawnWeightAdjustments)}

Respond ONLY with a JSON object in this exact shape:
{
  "analysis": "<2-3 sentence plain English analysis of the patch impact>",
  "recommendations": ["<actionable recommendation 1>", "<actionable recommendation 2>"],
  "projectedRTP": <number between 0 and 2>,
  "projectedRTPRange": [<low>, <high>],
  "riskLevel": "<low|medium|high>",
  "approved": <true|false>
}`;
}

function parseGovernanceResponse(text: string, proposal: RTPProposal): GovernanceAuditResult {
  try {
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (json) {
      const parsed = JSON.parse(json) as GovernanceAuditResult;
      if (
        typeof parsed.analysis === 'string' &&
        Array.isArray(parsed.recommendations) &&
        typeof parsed.projectedRTP === 'number'
      ) {
        return parsed;
      }
    }
  } catch {
    // fall through to deterministic fallback
  }

  // Deterministic fallback when AI response cannot be parsed
  const { avgScore, farkleRate, sessionsRun } = proposal.simulationResults;
  const BASE_SCORE = 4500;
  const projectedRTP = Number(((avgScore / BASE_SCORE) * 0.92).toFixed(4));
  const margin = farkleRate * 0.05;
  const projectedRTPRange: [number, number] = [
    Number((projectedRTP - margin).toFixed(4)),
    Number((projectedRTP + margin).toFixed(4)),
  ];
  const rtpDelta = projectedRTP - proposal.baselineRTP;
  const riskLevel: 'low' | 'medium' | 'high' =
    Math.abs(rtpDelta) < 0.02 ? 'low' : Math.abs(rtpDelta) < 0.05 ? 'medium' : 'high';
  const approved = projectedRTP >= 0.88 && projectedRTP <= 1.05;

  return {
    analysis: `Patch "${proposal.patchName}" projects an RTP of ${(projectedRTP * 100).toFixed(1)}% against baseline ${(proposal.baselineRTP * 100).toFixed(1)}% over ${sessionsRun} sessions. (Deterministic fallback — AI response unparseable.)`,
    recommendations: [approved ? `Patch within approved RTP band [0.88–1.05] across ${sessionsRun} sessions.` : 'Projected RTP outside approved band [0.88–1.05] — do not ship without further tuning.'],
    projectedRTP,
    projectedRTPRange,
    riskLevel,
    approved,
  };
}

export const governanceAuditor = { analyze };
