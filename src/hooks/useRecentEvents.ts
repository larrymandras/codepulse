import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRecentEvents(initialNumItems = 50) {
  const [limit, setLimit] = useState(initialNumItems);
  const results = useQuery(api.events.listRecentMerged, { limit });

  const status: "LoadingFirstPage" | "CanLoadMore" | "Exhausted" =
    results === undefined
      ? "LoadingFirstPage"
      : results.length >= limit
        ? "CanLoadMore"
        : "Exhausted";

  const loadMore = (n: number) => setLimit((prev) => prev + n);

  return { events: results ?? [], status, loadMore };
}
