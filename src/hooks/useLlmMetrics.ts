import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useLlmMetrics(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.llm.recentCallsPaginated,
    {},
    { initialNumItems }
  );
  return { calls: results ?? [], status, loadMore };
}
