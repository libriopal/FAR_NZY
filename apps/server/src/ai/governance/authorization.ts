import { AI_CONFIG } from '../config.js';

export type AuditCallType = 'governance' | 'monte-carlo' | 'economy' | 'opportunity' | 'quest';

const VALID_CALL_TYPES = new Set<AuditCallType>([
  'governance', 'monte-carlo', 'economy', 'opportunity', 'quest',
]);

export class AuthorizationError extends Error {
  constructor(reason: string) {
    super(`AuthorizationError: ${reason}`);
  }
}

export function authorize(callType: AuditCallType): void {
  if (!VALID_CALL_TYPES.has(callType)) {
    throw new AuthorizationError(`Unrecognized call type: '${callType}'`);
  }

  if (!AI_CONFIG.cohereApiKey) {
    throw new AuthorizationError('COHERE_API_KEY is not configured');
  }
}

export const authorization = { authorize };
