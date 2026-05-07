// ─── US Sweepstakes Compliance System ────────────────────────────────────────

export const RESTRICTED_STATES: ReadonlySet<string> = new Set([
  'WA', // Washington — stricter sweepstakes regulations
]);

export const DEFAULT_MIN_AGE = 18;

export interface ComplianceCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface ComplianceProfile {
  birthYear: number;
  birthMonth: number; // 1-12
  birthDay: number;
  state: string; // 2-letter US state code
  termsAccepted: boolean;
  termsAcceptedAt: number | null; // unix ms
  ageVerifiedAt: number | null;
}

export class ComplianceService {
  private readonly minAge: number;

  constructor(minAge: number = DEFAULT_MIN_AGE) {
    this.minAge = minAge;
  }

  checkAge(profile: Pick<ComplianceProfile, 'birthYear' | 'birthMonth' | 'birthDay'>): ComplianceCheckResult {
    const today = new Date();
    const birthDate = new Date(profile.birthYear, profile.birthMonth - 1, profile.birthDay);
    const age = today.getFullYear() - birthDate.getFullYear()
      - (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);

    if (age < this.minAge) {
      return { allowed: false, reason: `Must be at least ${this.minAge} years old.` };
    }
    return { allowed: true };
  }

  checkState(state: string): ComplianceCheckResult {
    const upper = state.toUpperCase();
    if (RESTRICTED_STATES.has(upper)) {
      return { allowed: false, reason: `Sweepstakes not available in ${upper}.` };
    }
    return { allowed: true };
  }

  checkTermsAccepted(profile: Pick<ComplianceProfile, 'termsAccepted'>): ComplianceCheckResult {
    if (!profile.termsAccepted) {
      return { allowed: false, reason: 'Must accept Terms and Conditions.' };
    }
    return { allowed: true };
  }

  fullCheck(profile: ComplianceProfile): ComplianceCheckResult {
    const age = this.checkAge(profile);
    if (!age.allowed) return age;

    const state = this.checkState(profile.state);
    if (!state.allowed) return state;

    const terms = this.checkTermsAccepted(profile);
    if (!terms.allowed) return terms;

    return { allowed: true };
  }

  // Returns flags suitable for storage in backend
  buildComplianceFlags(profile: ComplianceProfile): ComplianceFlags {
    const ageResult = this.checkAge(profile);
    const stateResult = this.checkState(profile.state);
    return {
      ageVerified: ageResult.allowed,
      stateAllowed: stateResult.allowed,
      termsAccepted: profile.termsAccepted,
      termsAcceptedAt: profile.termsAcceptedAt,
      restrictedState: !stateResult.allowed ? profile.state : null,
      minAgeRequired: this.minAge,
      verifiedAt: Date.now(),
    };
  }
}

export interface ComplianceFlags {
  ageVerified: boolean;
  stateAllowed: boolean;
  termsAccepted: boolean;
  termsAcceptedAt: number | null;
  restrictedState: string | null;
  minAgeRequired: number;
  verifiedAt: number;
}

// ─── Age Gate UI State Machine ────────────────────────────────────────────────

export type AgeGateStep = 'entry' | 'age_input' | 'state_select' | 'terms' | 'approved' | 'denied';

export interface AgeGateState {
  step: AgeGateStep;
  profile: Partial<ComplianceProfile>;
  denialReason?: string | undefined;
}

export function createAgeGateStateMachine(minAge = DEFAULT_MIN_AGE) {
  const service = new ComplianceService(minAge);

  return {
    advance(state: AgeGateState, action: Partial<ComplianceProfile>): AgeGateState {
      const updated: AgeGateState = {
        ...state,
        profile: { ...state.profile, ...action },
      };

      if (updated.step === 'age_input') {
        const { birthYear, birthMonth, birthDay } = updated.profile;
        if (!birthYear || !birthMonth || !birthDay) return updated;
        const result = service.checkAge({ birthYear, birthMonth, birthDay });
        if (!result.allowed) return { ...updated, step: 'denied', denialReason: result.reason };
        return { ...updated, step: 'state_select' };
      }

      if (updated.step === 'state_select') {
        const { state: st } = updated.profile;
        if (!st) return updated;
        const result = service.checkState(st);
        if (!result.allowed) return { ...updated, step: 'denied', denialReason: result.reason };
        return { ...updated, step: 'terms' };
      }

      if (updated.step === 'terms') {
        if (!updated.profile.termsAccepted) return updated;
        return {
          ...updated,
          step: 'approved',
          profile: { ...updated.profile, termsAcceptedAt: Date.now(), ageVerifiedAt: Date.now() },
        };
      }

      return updated;
    },

    getInitialState(): AgeGateState {
      return { step: 'entry', profile: {} };
    },
  };
}
