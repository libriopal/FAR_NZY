import { AI_CONFIG } from '../config.js';
import { spendTracker } from './spendTracker.js';

export enum SpendCategory {
  GOVERNANCE         = 'GOVERNANCE',         // ceiling: $300
  MONTE_CARLO        = 'MONTE_CARLO',        // ceiling: $250
  OPPORTUNITY_ENGINE = 'OPPORTUNITY_ENGINE', // ceiling: $150 (scaffold only at launch)
  RETRIEVAL          = 'RETRIEVAL',          // ceiling: $150 (deferred — $0 at launch)
  QUEST_GENERATION   = 'QUEST_GENERATION',   // ceiling: $50
}

export type BudgetStatus = 'ok' | 'warning' | 'restricted' | 'shutdown';

export class BudgetExceededError extends Error {
  constructor(public readonly category: SpendCategory) {
    super(`Budget category '${category}' has reached its shutdown threshold`);
  }
}

const CEILINGS: Record<SpendCategory, () => number> = {
  [SpendCategory.GOVERNANCE]:         () => AI_CONFIG.budgetGovernance,
  [SpendCategory.MONTE_CARLO]:        () => AI_CONFIG.budgetMonteCarlo,
  [SpendCategory.OPPORTUNITY_ENGINE]: () => AI_CONFIG.budgetOpportunity,
  [SpendCategory.RETRIEVAL]:          () => AI_CONFIG.budgetRetrieval,
  [SpendCategory.QUEST_GENERATION]:   () => AI_CONFIG.budgetQuest,
};

export class BudgetManager {
  checkBudget(category: SpendCategory): BudgetStatus {
    const ceiling = CEILINGS[category]();
    const spent = spendTracker.getCategorySpend(category);
    const fraction = ceiling > 0 ? spent / ceiling : 0;

    if (fraction >= AI_CONFIG.thresholdShutdown) return 'shutdown';
    if (fraction >= AI_CONFIG.thresholdRestrict) return 'restricted';
    if (fraction >= AI_CONFIG.thresholdWarn)     return 'warning';
    return 'ok';
  }

  enforceBudget(category: SpendCategory): void {
    const status = this.checkBudget(category);
    if (status === 'shutdown') throw new BudgetExceededError(category);

    if (status === 'warning') {
      process.stderr.write(
        `[BudgetManager] WARNING: ${category} is at or above ${AI_CONFIG.thresholdWarn * 100}% of ceiling\n`
      );
    }

    if (status === 'restricted' && category !== SpendCategory.GOVERNANCE) {
      throw new BudgetExceededError(category);
    }
  }

  getAllStatus(): Record<SpendCategory, BudgetStatus> {
    return {
      [SpendCategory.GOVERNANCE]:         this.checkBudget(SpendCategory.GOVERNANCE),
      [SpendCategory.MONTE_CARLO]:        this.checkBudget(SpendCategory.MONTE_CARLO),
      [SpendCategory.OPPORTUNITY_ENGINE]: this.checkBudget(SpendCategory.OPPORTUNITY_ENGINE),
      [SpendCategory.RETRIEVAL]:          this.checkBudget(SpendCategory.RETRIEVAL),
      [SpendCategory.QUEST_GENERATION]:   this.checkBudget(SpendCategory.QUEST_GENERATION),
    };
  }
}

export const budgetManager = new BudgetManager();
