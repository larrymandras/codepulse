import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: new Proxy({}, {
    get: () => new Proxy({}, { get: () => "mock-fn-ref" }),
  }),
}));

describe("Dreaming Page (CPUX-07)", () => {
  test.todo("renders 4 tabs: Timeline, Facts, Cost, Backfill");
  test.todo("Timeline tab shows cycle history");
  test.todo("Facts tab renders searchable/filterable table");
  test.todo("Cost tab shows per-run spend");
  test.todo("extraction funnel renders 5 stages");
});
