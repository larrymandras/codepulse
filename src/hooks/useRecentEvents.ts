import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRecentEvents(initialNumItems = 50) {
  const result = useQuery(api.events.listRecentUnified, {
    limit: initialNumItems,
  });
  return {
    events: result ?? [],
    status: result !== undefined ? ("Exhausted" as const) : ("LoadingFirstPage" as const),
    loadMore: () => {},
  };
}
