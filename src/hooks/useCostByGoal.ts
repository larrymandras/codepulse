/**
 * useCostByGoal — Convex live-query hooks for per-goal cost observability.
 *
 * Phase 149-04 — PULSE-04.
 * Mirrors useAgentTopology's "skip" sentinel pattern for conditional queries.
 *
 * Phase 104 D-01 (2026-07-31): dollars are recomputed from tokens x
 * modelPricing rate via convex/costDerived.ts's deriveBucketDollars() — the
 * same derivation every other cost surface in the phase uses, so this
 * goal-scoped HivePage breakdown can no longer disagree with Analytics. The
 * ingested `cost` field survives only as `reportedCost`/`reportedTotal`
 * (evidence, not the rendered truth). Do not reintroduce a bare `cost` field
 * or a combined total-`cost` field on either shape below.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { DerivedRow } from "../../convex/costDerived";

export type CostByGoalResult = {
  rows: DerivedRow[];
  billedTotal: number;
  coveredTotal: number;
  unpricedModelCount: number;
  /** The ingested-cost figure, kept as evidence (D-01) — never the rendered truth. */
  reportedTotal: number;
};

export type LlmRow = {
  agentId?: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  billingType: string;
  /** null when the row is unpriced or billingType is subscription (D-03/D-05). */
  billedUsd: number | null;
  /** The ingested-cost figure, kept as evidence (D-01) — never the rendered truth. */
  reportedCost: number;
};

const DEFAULT_COST: CostByGoalResult = {
  rows: [],
  billedTotal: 0,
  coveredTotal: 0,
  unpricedModelCount: 0,
  reportedTotal: 0,
};

/**
 * Returns derived per-(provider, model) cost rows for the given goalId.
 * Uses "skip" sentinel when goalId is null/undefined so no query fires.
 * Returns DEFAULT_COST when loading or goalId is absent.
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
 * Returns raw per-row {agentId, model, provider, ...} rows for the given goalId.
 * Used by CostBreakdown for the model-tier flag join (D-12) and per-row dollar display.
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
