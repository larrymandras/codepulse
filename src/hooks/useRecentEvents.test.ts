import { describe, test, expect, vi, type MockedFunction } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuery } from "convex/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [
    { _id: "1", eventType: "llm_call", source: "runtime", timestamp: 1000 },
    { _id: "2", eventType: "ToolUse", source: "build", timestamp: 999 },
  ]),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    events: { listRecentMerged: "events.listRecentMerged" },
  },
}));

import { useRecentEvents } from "./useRecentEvents";

const mockUseQuery = useQuery as MockedFunction<typeof useQuery>;

describe("useRecentEvents (merged)", () => {
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

  test("status is Exhausted when results are fewer than limit", () => {
    const { result } = renderHook(() => useRecentEvents(50));
    expect(result.current.status).toBe("Exhausted");
  });

  test("status is LoadingFirstPage when query returns undefined", () => {
    mockUseQuery.mockReturnValueOnce(undefined);
    const { result } = renderHook(() => useRecentEvents());
    expect(result.current.status).toBe("LoadingFirstPage");
  });

  test("loadMore increases the limit", () => {
    const { result } = renderHook(() => useRecentEvents(50));
    act(() => result.current.loadMore(25));
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      { limit: 75 }
    );
  });

  test("passes default limit of 50", () => {
    renderHook(() => useRecentEvents());
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.anything(),
      { limit: 50 }
    );
  });
});
