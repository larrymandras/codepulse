import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(function (this: any) {
    this.query = mockQuery;
  }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: { heroStats: { summary: "heroStats:summary" } },
}));

import { usePollQuery } from "./usePollQuery";
import { api } from "../../convex/_generated/api";

describe("usePollQuery", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined data and isStale false initially", () => {
    const { result } = renderHook(() =>
      usePollQuery(api.heroStats.summary as any, {}, 5000)
    );
    expect(result.current.data).toBeUndefined();
    expect(result.current.isStale).toBe(false);
    expect(typeof result.current.refetch).toBe("function");
  });

  it("calls ConvexHttpClient.query on mount", async () => {
    renderHook(() => usePollQuery(api.heroStats.summary as any, {}, 5000));
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  it("updates data after fetch resolves", async () => {
    mockQuery.mockResolvedValue({ count: 42 });
    const { result } = renderHook(() =>
      usePollQuery(api.heroStats.summary as any, {}, 5000)
    );
    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 42 });
    });
  });

  it("polls again after intervalMs elapses", async () => {
    vi.useFakeTimers();
    mockQuery.mockResolvedValue({ count: 1 });
    renderHook(() => usePollQuery(api.heroStats.summary as any, {}, 5000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const callsAfterMount = mockQuery.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });

    expect(mockQuery.mock.calls.length).toBeGreaterThan(callsAfterMount);
    vi.useRealTimers();
  });

  it("clears interval on unmount", async () => {
    vi.useFakeTimers();
    mockQuery.mockResolvedValue({ count: 1 });
    const { unmount } = renderHook(() =>
      usePollQuery(api.heroStats.summary as any, {}, 5000)
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    unmount();
    const callsBefore = mockQuery.mock.calls.length;

    vi.advanceTimersByTime(15000);
    expect(mockQuery.mock.calls.length).toBe(callsBefore);
    vi.useRealTimers();
  });

  it("sets isStale true when query throws", async () => {
    mockQuery.mockRejectedValue(new Error("network fail"));
    const { result } = renderHook(() =>
      usePollQuery(api.heroStats.summary as any, {}, 5000)
    );
    await waitFor(() => {
      expect(result.current.isStale).toBe(true);
    });
  });

  it("refetch triggers an immediate fetch", async () => {
    mockQuery.mockResolvedValue({ count: 1 });
    const { result } = renderHook(() =>
      usePollQuery(api.heroStats.summary as any, {}, 60000)
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ count: 1 });
    });

    const callsBefore = mockQuery.mock.calls.length;
    mockQuery.mockResolvedValue({ count: 99 });

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(mockQuery.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
