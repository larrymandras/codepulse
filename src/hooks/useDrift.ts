import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDriftChanges() {
  return useQuery(api.drift.recentChanges) ?? [];
}

export function useDriftSummary() {
  return useQuery(api.drift.driftSummary) ?? {
    changesLastHour: 0,
    changesLast24h: 0,
    byCategory: {},
    velocity: [],
    isDrifting: false,
  };
}
