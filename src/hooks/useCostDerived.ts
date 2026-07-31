/**
 * useCostDerived — Convex live-query hooks for convex/costDerived.ts's
 * costBreakdown / unpricedModels queries.
 *
 * Phase 104 Plan 09 (COST-01 breakdown table + unpriced-models nudge).
 * Mirrors useCostByGoal.ts's `useQuery(...) ?? DEFAULT` wrapper convention —
 * loading and "no data" both collapse to the same honest-empty default shape
 * so every consumer can render unconditionally.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { DerivedRow } from "../../convex/costDerived";

export type CostBreakdownResult = {
  rows: DerivedRow[];
  billedTotal: number;
  coveredTotal: number;
  unpricedModelCount: number;
  unpricedTokenTotal: number;
};

export type UnpricedModelsResult = {
  count: number;
  models: Array<{
    provider: string;
    model: string;
    billingType: string;
    promptTokens: number;
    completionTokens: number;
  }>;
};

const DEFAULT_BREAKDOWN: CostBreakdownResult = {
  rows: [],
  billedTotal: 0,
  coveredTotal: 0,
  unpricedModelCount: 0,
  unpricedTokenTotal: 0,
};

const DEFAULT_UNPRICED: UnpricedModelsResult = { count: 0, models: [] };

/**
 * Per-(provider, model, billingType) cost breakdown over the given window.
 * `period`/`lookbackHours` mirror `costDerived.costBreakdown`'s own args —
 * see `src/components/CostBreakdownTable.tsx`'s window-selector mapping.
 */
export function useCostBreakdown(period: string, lookbackHours?: number): CostBreakdownResult {
  return (
    (useQuery(api.costDerived.costBreakdown, {
      period,
      lookbackHours,
    }) as CostBreakdownResult | undefined) ?? DEFAULT_BREAKDOWN
  );
}

/**
 * The single source for "how many models need a pricing rate" — the exact
 * same query `ModelPricingAdmin`'s suggestion list reads (D-03), so the two
 * surfaces can never disagree.
 */
export function useUnpricedModels(lookbackHours?: number): UnpricedModelsResult {
  return (
    (useQuery(api.costDerived.unpricedModels, {
      lookbackHours,
    }) as UnpricedModelsResult | undefined) ?? DEFAULT_UNPRICED
  );
}
