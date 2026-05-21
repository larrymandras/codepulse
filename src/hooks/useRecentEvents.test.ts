import { describe, test, expect, vi, type MockedFunction } from "vitest";
import { renderHook } from "@testing-library/react";
import { useQuery } from "convex/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "1", eventType: "Info", timestamp: 1000 }]),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    events: { listRecentUnified: "events.listRecentUnified" },
  },
}));

import { useRecentEvents } from "./useRecentEvents";

const mockUseQuery = useQuery as MockedFunction<typeof useQuery>;

describe("useRecentEvents", () => {
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

  test("status is Exhausted when data is loaded", () => {
    const { result } = renderHook(() => useRecentEvents());
    expect(result.current.status).toBe("Exhausted");
  });

  test("status is LoadingFirstPage when query returns undefined", () => {
    mockUseQuery.mockReturnValueOnce(undefined as any);
    const { result } = renderHook(() => useRecentEvents());
    expect(result.current.status).toBe("LoadingFirstPage");
  });

  test("passes limit of 50 by default", () => {
    renderHook(() => useRecentEvents());
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      { limit: 50 }
    );
  });

  test("passes custom limit when provided", () => {
    renderHook(() => useRecentEvents(100));
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      { limit: 100 }
    );
  });
});
