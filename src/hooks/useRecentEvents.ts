import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRecentEvents(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.events.listRecentPaginated,
    {},
    { initialNumItems }
  );
  return { events: results ?? [], status, loadMore };
}
