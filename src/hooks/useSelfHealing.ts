import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useComponentHealth() {
  return useQuery(api.selfHealing.componentHealth) ?? [];
}

export function useRecentRecoveries() {
  return useQuery(api.selfHealing.recentRecoveries, {}) ?? [];
}

export function useUptimeStats() {
  return useQuery(api.selfHealing.uptimeStats);
}

export function useVersionHistory() {
  return useQuery(api.selfHealing.listVersions, {}) ?? [];
}
