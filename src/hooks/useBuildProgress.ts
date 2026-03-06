import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useBuildProgress() {
  return useQuery(api.build.phaseProgress) ?? [];
}

export function usePhaseOverview() {
  return useQuery(api.build.phaseOverview) ?? [];
}

export function useBuildActivity(limit?: number) {
  return useQuery(api.build.recentActivity, { limit }) ?? [];
}

export function usePipelines() {
  return useQuery(api.pipelines.listAll, {}) ?? [];
}
