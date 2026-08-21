import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useActiveAlerts() {
  return useQuery(api.alerts.listActive) ?? [];
}

export function useGroupedAlerts() {
  return useQuery(api.alerts.listActiveGrouped) ?? [];
}

export function useAllAlerts(limit?: number) {
  return useQuery(api.alerts.listAll, { limit }) ?? [];
}

/**
 * D-12 (124-CONTEXT.md, amended 2026-08-21): returns the raw `useQuery`
 * result — `undefined` while loading, never a fabricated zeroed shape. A `0`
 * that actually means "not loaded yet" is precisely the fabricated-confidence
 * defect POLISH-04 exists to prevent, and 122's TOKEN-04 six-state law
 * already forbids it elsewhere. Every caller MUST guard on `undefined`
 * before touching the result — see `AlertBanner.tsx` and `Alerts.tsx`.
 */
export function useAlertCounts() {
  return useQuery(api.alerts.countBySeverity);
}

export function useAllAlertsPaginated(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.alerts.listAllPaginated,
    {},
    { initialNumItems }
  );
  return { alerts: results ?? [], status, loadMore };
}
