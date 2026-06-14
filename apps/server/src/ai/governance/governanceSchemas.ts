import { z } from 'zod';

// Input: RTP proposal from Sandbox
export const RTPProposalSchema = z.object({
  patchName:              z.string(),
  patchDescription:       z.string(),
  baselineRTP:            z.number().min(0).max(2),
  simulationResults: z.object({
    avgScore:    z.number(),
    farkleRate:  z.number().min(0).max(1),
    sessionsRun: z.number().int(),
  }),
  spawnWeightAdjustments: z.record(z.string(), z.number()),
});

// Output: Governance audit finding
export const GovernanceAuditResultSchema = z.object({
  analysis:            z.string(),
  recommendations:     z.array(z.string()),
  projectedRTP:        z.number(),
  projectedRTPRange:   z.tuple([z.number(), z.number()]),
  riskLevel:           z.enum(['low', 'medium', 'high']),
  approved:            z.boolean(),
});

export type RTPProposal = z.infer<typeof RTPProposalSchema>;
export type GovernanceAuditResult = z.infer<typeof GovernanceAuditResultSchema>;

export function validateRTPProposal(input: unknown): RTPProposal {
  return RTPProposalSchema.parse(input);
}
