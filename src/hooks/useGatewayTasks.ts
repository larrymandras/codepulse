import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useGatewayTasksPaginated(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.gatewayTasks.listPaginated,
    {},
    { initialNumItems }
  );
  return { tasks: results ?? [], status, loadMore };
}
