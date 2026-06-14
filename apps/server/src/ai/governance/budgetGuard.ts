import { budgetManager, SpendCategory, type BudgetStatus } from '../spend/budgetManager.js';
import { BudgetExceededError } from '../spend/budgetManager.js';

export function checkBudget(category: SpendCategory): BudgetStatus {
  return budgetManager.checkBudget(category);
}

export function enforceBudget(category: SpendCategory): void {
  budgetManager.enforceBudget(category);
}

export const budgetGuard = { checkBudget, enforceBudget };
