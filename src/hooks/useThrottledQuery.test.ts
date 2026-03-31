import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: { heroStats: { summary: "heroStats:summary" } },
}));

import { useQuery } from "convex/react";
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

const mockUseQuery = vi.mocked(useQuery);

describe("useThrottledQuery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseQuery.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns undefined initially when query has no data", () => {
    const { result } = renderHook(() =>
      useThrottledQuery(api.heroStats.summary, {}, 500)
    );
    expect(result.current).toBeUndefined();
  });

  it("passes through first value immediately", () => {
    mockUseQuery.mockReturnValue({ count: 1 });
    const { result } = renderHook(() =>
      useThrottledQuery(api.heroStats.summary, {}, 500)
    );
    expect(result.current).toEqual({ count: 1 });
  });

  it("throttles rapid updates", () => {
    mockUseQuery.mockReturnValue({ count: 1 });
    const { result, rerender } = renderHook(() =>
      useThrottledQuery(api.heroStats.summary, {}, 500)
    );
    expect(result.current).toEqual({ count: 1 });

    // Rapid update at 100ms — should be delayed
    act(() => {
      vi.advanceTimersByTime(100);
    });
    mockUseQuery.mockReturnValue({ count: 2 });
    rerender();
    // Still shows old value (throttled)
    expect(result.current).toEqual({ count: 1 });

    // After remaining 400ms, should update
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toEqual({ count: 2 });
  });

  it("allows update after interval has passed", () => {
    mockUseQuery.mockReturnValue({ count: 1 });
    const { result, rerender } = renderHook(() =>
      useThrottledQuery(api.heroStats.summary, {}, 500)
    );

    // Wait full interval
    act(() => {
      vi.advanceTimersByTime(500);
    });

    mockUseQuery.mockReturnValue({ count: 5 });
    rerender();
    expect(result.current).toEqual({ count: 5 });
  });
});
