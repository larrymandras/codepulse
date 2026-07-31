/**
 * useModelPricing — Convex live-query hook for the modelPricing rate table.
 *
 * Phase 104 Plan 07 (Cost & Budgets admin UI).
 * Mirrors useCostByGoal.ts's convention exactly: a module-level default
 * constant, then `useQuery(...) ?? DEFAULT`. Loading and "genuinely no rates
 * configured" both collapse to the same empty array — that is intentional
 * and matches the project-wide `useQuery(api.domain.fn) ?? []` pattern
 * (CLAUDE.md Patterns section). ModelPricingAdmin's own empty-state copy is
 * written to make sense either way ("No pricing rates configured").
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { PricingRow } from "../../convex/modelPricing";

const EMPTY_PRICING: PricingRow[] = [];

export function useModelPricing(): PricingRow[] {
  return (useQuery(api.modelPricing.list) as PricingRow[] | undefined) ?? EMPTY_PRICING;
}
