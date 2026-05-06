import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function usePendingWakeups(limit?: number) {
  return useQuery(api.wakeups.listPending, limit ? { limit } : {}) ?? [];
}

export function useRecentWakeups(limit?: number) {
  return useQuery(api.wakeups.recentFired, limit ? { limit } : {}) ?? [];
}
