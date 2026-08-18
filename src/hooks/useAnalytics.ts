import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useSessionList(limit?: number) {
  return useQuery(api.sessions.listAll, limit ? { limit } : {}) ?? [];
}

export function useCapabilityGrowth() {
  return useQuery(api.registry.capabilityGrowth) ?? [];
}
