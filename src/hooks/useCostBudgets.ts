/**
 * useCostBudgets / useCostBudget — Convex live-query hooks for the
 * costBudgets table.
 *
 * Phase 104 Plan 07 (Cost & Budgets admin UI).
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { BudgetRow, BudgetScope, BudgetPeriod } from "../../convex/costBudgets";

const EMPTY_BUDGETS: BudgetRow[] = [];

/** Mirrors useCostByGoal.ts's shape: loading and "no budgets" both collapse to []. */
export function useCostBudgets(): BudgetRow[] {
  return (useQuery(api.costBudgets.list) as BudgetRow[] | undefined) ?? EMPTY_BUDGETS;
}

/**
 * Returns the raw `getByScope` result, INCLUDING `undefined` while loading —
 * deliberately NOT collapsed to `null` here. Plan 104-08's panels need to
 * tell "still loading" (undefined) apart from "no budget configured for
 * this scope" (a genuine null returned by the query once it resolves); if
 * this hook folded both to null, a panel would flash a false "no budget
 * configured" empty state on every mount before the real answer arrives.
 */
export function useCostBudget(
  scope: BudgetScope,
  scopeKey: string,
  period: BudgetPeriod
): BudgetRow | null | undefined {
  return useQuery(api.costBudgets.getByScope, { scope, scopeKey, period }) as
    | BudgetRow
    | null
    | undefined;
}
