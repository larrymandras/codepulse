import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useSuperLoopIterations(limit?: number) {
  return useQuery(api.superLoops.recentAll, limit ? { limit } : {}) ?? [];
}
