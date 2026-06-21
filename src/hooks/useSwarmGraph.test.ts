import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock convex/react before any imports that use it
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    swarmTasks: {
      byGoal: "swarmTasks:byGoal",
      listGoals: "swarmTasks:listGoals",
    },
  },
}));

import { useQuery } from "convex/react";
import { useSwarmGraph, useGoalList } from "./useSwarmGraph";

const mockUseQuery = vi.mocked(useQuery);

describe("useSwarmGraph", () => {
  it("returns [] when useQuery returns undefined (loading)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useSwarmGraph("goal-1"));
    expect(result.current).toEqual([]);
  });

  it("returns [] when goalId is null (skip sentinel path)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useSwarmGraph(null));
    expect(result.current).toEqual([]);
  });

  it("passes 'skip' sentinel to useQuery when goalId is null", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useSwarmGraph(null));
    // The second argument to useQuery should be "skip"
    const calls = mockUseQuery.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toBe("skip");
  });

  it("passes { goalId } to useQuery when goalId is set", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useSwarmGraph("goal-abc"));
    const calls = mockUseQuery.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toEqual({ goalId: "goal-abc" });
  });

  it("returns the rows when useQuery has data", () => {
    const rows = [
      { goalId: "g1", subtaskId: "t1", state: "running", subtask: "do stuff", dependsOn: [], timestamp: 1 },
    ];
    mockUseQuery.mockReturnValue(rows as ReturnType<typeof useQuery>);
    const { result } = renderHook(() => useSwarmGraph("g1"));
    expect(result.current).toEqual(rows);
  });
});

describe("useGoalList", () => {
  it("returns [] when useQuery returns undefined (loading)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useGoalList());
    expect(result.current).toEqual([]);
  });

  it("returns data when useQuery has results", () => {
    const goals = [{ goalId: "g1", firstSubtask: "do something", latestState: "running", createdAt: 1, updatedAt: 1 }];
    mockUseQuery.mockReturnValue(goals as ReturnType<typeof useQuery>);
    const { result } = renderHook(() => useGoalList());
    expect(result.current).toEqual(goals);
  });
});
