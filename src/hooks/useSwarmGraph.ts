/**
 * useSwarmGraph — Convex live-query hook for swarm task observability.
 *
 * Phase 149-03 — PULSE-03.
 * Mirrors useAgentTopology's "skip" sentinel pattern for conditional queries.
 * useSwarmGraph(goalId): returns swarmTasks rows for the given goal, or []
 * useGoalList(): returns all swarmGoals rows newest-first (for GoalPicker)
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type SwarmTaskRow = {
  goalId: string;
  subtaskId: string;
  state: string;
  subtask: string;
  dependsOn: string[];
  claimedBy?: string;
  model?: string;
  agentId?: string;
  timestamp: number;
  updatedAt?: number;
};

export type SwarmGoalRow = {
  goalId: string;
  firstSubtask: string;
  latestState: string;
  createdAt: number;
  updatedAt: number;
};

/**
 * Returns swarmTask rows for the given goalId.
 * Uses "skip" sentinel when goalId is null/undefined so no query fires.
 * Returns [] when the query is loading (undefined) or goalId is absent.
 */
export function useSwarmGraph(goalId: string | null | undefined): SwarmTaskRow[] {
  return (
    (useQuery(
      api.swarmTasks.byGoal,
      goalId ? { goalId } : "skip"
    ) as SwarmTaskRow[] | undefined) ?? []
  );
}

/**
 * Returns all swarmGoal rows, newest-first (for GoalPicker).
 * Returns [] when loading.
 */
export function useGoalList(): SwarmGoalRow[] {
  return (
    (useQuery(api.swarmTasks.listGoals) as SwarmGoalRow[] | undefined) ?? []
  );
}
