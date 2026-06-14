import { RESTRICTED_STATES } from '@match3d/compliance';

export class ComplianceViolationError extends Error {
  constructor(public readonly state: string) {
    super(`ComplianceViolation: Casino-related AI calls are not permitted for state '${state}'`);
  }
}

export function checkCompliance(context?: { state?: string }): void {
  if (!context?.state) return;
  const upper = context.state.toUpperCase();
  if (RESTRICTED_STATES.has(upper)) {
    throw new ComplianceViolationError(upper);
  }
}

export const complianceGuard = { checkCompliance };
