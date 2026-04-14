import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useSecurityEvents() {
  return useQuery(api.security.recentEvents) ?? [];
}

export function useSecurityCounts() {
  return useQuery(api.security.severityCounts);
}

export function useSecurityEventsPaginated(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.security.recentEventsPaginated,
    {},
    { initialNumItems }
  );
  return { events: results ?? [], status, loadMore };
}
