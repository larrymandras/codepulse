import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useCostOverTime() {
  return useQuery(api.llm.costOverTime) ?? [];
}

export function useLatencyOverTime() {
  return useQuery(api.llm.latencyOverTime) ?? [];
}

export function useSessionList(limit?: number) {
  return useQuery(api.sessions.listAll, limit ? { limit } : {}) ?? [];
}

export function useCapabilityGrowth() {
  return useQuery(api.registry.capabilityGrowth) ?? [];
}
