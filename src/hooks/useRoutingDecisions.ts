import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRoutingDecisionsPaginated(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.routingDecisions.listPaginated,
    {},
    { initialNumItems }
  );
  return { decisions: results ?? [], status, loadMore };
}
