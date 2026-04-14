import { describe, test, expect, vi, type MockedFunction } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePaginatedQuery } from "convex/react";

// Mock convex/react to avoid needing a real Convex client
vi.mock("convex/react", () => ({
  usePaginatedQuery: vi.fn(() => ({
    results: [{ _id: "1", eventType: "Info", timestamp: 1000 }],
    status: "CanLoadMore" as const,
    loadMore: vi.fn(),
  })),
}));

// Mock the generated API
vi.mock("../../convex/_generated/api", () => ({
  api: {
    events: { listRecentPaginated: "events.listRecentPaginated" },
  },
}));

import { useRecentEvents } from "./useRecentEvents";

const mockUsePaginatedQuery = usePaginatedQuery as MockedFunction<typeof usePaginatedQuery>;

describe("useRecentEvents (paginated)", () => {
  test("returns { events, status, loadMore } shape", () => {
    const { result } = renderHook(() => useRecentEvents());
    expect(result.current).toHaveProperty("events");
    expect(result.current).toHaveProperty("status");
    expect(result.current).toHaveProperty("loadMore");
  });

  test("events is an array", () => {
    const { result } = renderHook(() => useRecentEvents());
    expect(Array.isArray(result.current.events)).toBe(true);
  });

  test("status is a valid pagination status string", () => {
    const { result } = renderHook(() => useRecentEvents());
    expect(["LoadingFirstPage", "CanLoadMore", "LoadingMore", "Exhausted"]).toContain(
      result.current.status
    );
  });

  test("loadMore is a callable function", () => {
    const { result } = renderHook(() => useRecentEvents());
    expect(typeof result.current.loadMore).toBe("function");
  });

  test("passes initialNumItems of 25 by default", () => {
    renderHook(() => useRecentEvents());
    expect(mockUsePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      {},
      { initialNumItems: 25 }
    );
  });
});
