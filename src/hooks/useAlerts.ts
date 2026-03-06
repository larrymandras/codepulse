import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useActiveAlerts() {
  return useQuery(api.alerts.listActive) ?? [];
}

export function useAllAlerts(limit?: number) {
  return useQuery(api.alerts.listAll, { limit }) ?? [];
}

export function useAlertCounts() {
  return useQuery(api.alerts.countBySeverity) ?? { info: 0, warning: 0, error: 0, critical: 0 };
}
