/**
 * useCostByGoal — Convex live-query hooks for per-goal cost observability.
 *
 * Phase 149-04 — PULSE-04.
 * Mirrors useAgentTopology's "skip" sentinel pattern for conditional queries.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type CostRow = {
  provider: string;
  model: string;
  cost: number;
};

export type CostByGoalResult = {
  rows: CostRow[];
  totalCost: number;
};

export type LlmRow = {
  agentId?: string;
  model: string;
  provider: string;
  cost: number;
};

const DEFAULT_COST: CostByGoalResult = { rows: [], totalCost: 0 };

/**
 * Returns grouped (provider, model) cost rows for the given goalId.
 * Uses "skip" sentinel when goalId is null/undefined so no query fires.
 * Returns { rows: [], totalCost: 0 } when loading or goalId is absent.
 */
export function useCostByGoal(goalId: string | null | undefined): CostByGoalResult {
  return (
    (useQuery(
      api.aggregates.costByGoalPeriod,
      goalId ? { goalId } : "skip"
    ) as CostByGoalResult | undefined) ?? DEFAULT_COST
  );
}

/**
 * Returns raw (agentId, model, provider, cost) rows for the given goalId.
 * Used by CostBreakdown for the model-tier flag join (D-12).
 * Uses "skip" sentinel when goalId is null/undefined.
 * Returns [] when loading or goalId is absent.
 */
export function useLlmByGoal(goalId: string | null | undefined): LlmRow[] {
  return (
    (useQuery(
      api.aggregates.llmByGoal,
      goalId ? { goalId } : "skip"
    ) as LlmRow[] | undefined) ?? []
  );
}
