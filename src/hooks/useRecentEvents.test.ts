import { describe, test } from "vitest";

describe("useRecentEvents (paginated)", () => {
  test.todo("returns { events, status, loadMore } shape");
  test.todo("status is 'LoadingFirstPage' on initial render");
  test.todo("calls usePaginatedQuery with api.events.listRecentPaginated");
  test.todo("passes initialNumItems of 25 by default");
  test.todo("loadMore function is callable");
});
