// Governance schemas for audit inputs/outputs.
// NOTE: zod is absent from package.json at generation time (added in Phase 5).
// These are plain TypeScript interfaces matching the intended zod schema shapes exactly.
// After Phase 5 pnpm install, migrate to z.object() — shapes must not change.

// Input: RTP proposal from Sandbox
export interface SimulationResults {
  avgScore: number;
  farkleRate: number;
  sessionsRun: number;
}

export interface SpawnWeightAdjustments {
  [face: string]: number;
}

export interface RTPProposal {
  patchName: string;
  patchDescription: string;
  baselineRTP: number;              // 0–2
  simulationResults: SimulationResults;
  spawnWeightAdjustments: SpawnWeightAdjustments;
}

// Output: Governance audit finding
export interface GovernanceAuditResult {
  analysis: string;
  recommendations: string[];
  projectedRTP: number;
  projectedRTPRange: [number, number];
  riskLevel: 'low' | 'medium' | 'high';
  approved: boolean;
}

export function validateRTPProposal(input: unknown): RTPProposal {
  const p = input as Record<string, unknown>;
  if (typeof p['patchName'] !== 'string') throw new Error('patchName must be a string');
  if (typeof p['patchDescription'] !== 'string') throw new Error('patchDescription must be a string');
  if (typeof p['baselineRTP'] !== 'number') throw new Error('baselineRTP must be a number');
  const sim = p['simulationResults'] as Record<string, unknown>;
  if (!sim || typeof sim['avgScore'] !== 'number') throw new Error('simulationResults.avgScore must be a number');
  if (typeof sim['farkleRate'] !== 'number') throw new Error('simulationResults.farkleRate must be a number');
  if (typeof sim['sessionsRun'] !== 'number') throw new Error('simulationResults.sessionsRun must be a number');
  return p as unknown as RTPProposal;
}
