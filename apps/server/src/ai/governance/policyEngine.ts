// Enforced prohibited AI responsibilities — these must never be relaxed.
// Both pre-call and post-call validation run through this engine.

const PROHIBITED = [
  'rtp_calculation', 'rtp_determination',
  'rng_generation', 'rng_influence',
  'dice_outcome_selection', 'game_outcome_generation',
  'payout_calculation', 'payout_determination',
  'compliance_decision', 'reward_issuance',
  'gameplay_loop_execution',
] as const;

export type ProhibitedResponsibility = typeof PROHIBITED[number];

export class PolicyViolationError extends Error {
  constructor(public readonly responsibility: ProhibitedResponsibility) {
    super(`PolicyViolation: AI may not perform '${responsibility}'`);
  }
}

// Keyword patterns that suggest a prohibited responsibility in response text.
// These patterns are conservative — false positives are acceptable; false negatives are not.
const PROHIBITED_PATTERNS: Record<ProhibitedResponsibility, RegExp> = {
  rtp_calculation:           /\bI (?:calculated?|computed?|determined?) (?:the )?RTP\b/i,
  rtp_determination:         /\bRTP (?:is|will be|shall be) (?:exactly|definitively)\b/i,
  rng_generation:            /\bI (?:generated?|produced?|created?) (?:a )?(?:random|dice|roll)\b/i,
  rng_influence:             /\b(?:set|change|alter|modify) (?:the )?(?:random|seed|dice|RNG)\b/i,
  dice_outcome_selection:    /\b(?:dice|roll) (?:result|outcome|value) (?:is|will be|shall be)\b/i,
  game_outcome_generation:   /\b(?:game|match|round) (?:result|outcome|winner) (?:is|will be)\b/i,
  payout_calculation:        /\bI (?:calculated?|computed?) (?:the )?payout\b/i,
  payout_determination:      /\bpayout (?:is|will be|shall be) (?:exactly|\$[\d.]+)\b/i,
  compliance_decision:       /\b(?:player|user) (?:is|is not) (?:compliant|allowed|permitted|restricted)\b/i,
  reward_issuance:           /\bI (?:issued?|granted?|awarded?) (?:coins?|tokens?|rewards?)\b/i,
  gameplay_loop_execution:   /\b(?:executing?|running?) (?:the )?(?:game(?:play)?|scoring) loop\b/i,
};

export function validateCallType(callType: string): void {
  // Call type names must not match prohibited responsibilities
  const prohibited = PROHIBITED as readonly string[];
  if (prohibited.includes(callType)) {
    throw new PolicyViolationError(callType as ProhibitedResponsibility);
  }
}

export function validateResponse(responseText: string): void {
  for (const [responsibility, pattern] of Object.entries(PROHIBITED_PATTERNS)) {
    if (pattern.test(responseText)) {
      throw new PolicyViolationError(responsibility as ProhibitedResponsibility);
    }
  }
}

export const policyEngine = { validateCallType, validateResponse };
