import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock convex/react before any imports that use it
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    aggregates: {
      costByGoalPeriod: "aggregates:costByGoalPeriod",
      llmByGoal: "aggregates:llmByGoal",
    },
  },
}));

import { useQuery } from "convex/react";
import { useCostByGoal, useLlmByGoal } from "./useCostByGoal";

const mockUseQuery = vi.mocked(useQuery);

describe("useCostByGoal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default { rows: [], totalCost: 0 } when useQuery is undefined (loading)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useCostByGoal("goal-1"));
    expect(result.current).toEqual({ rows: [], totalCost: 0 });
  });

  it("passes 'skip' sentinel to useQuery when goalId is null", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useCostByGoal(null));
    const calls = mockUseQuery.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toBe("skip");
  });

  it("passes 'skip' sentinel to useQuery when goalId is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useCostByGoal(undefined));
    const calls = mockUseQuery.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toBe("skip");
  });

  it("passes { goalId } to useQuery when goalId is set", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useCostByGoal("goal-abc"));
    const calls = mockUseQuery.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toEqual({ goalId: "goal-abc" });
  });

  it("returns actual data when useQuery resolves", () => {
    const mockData = {
      rows: [
        { provider: "anthropic", model: "claude-sonnet-4-5", cost: 0.12 },
      ],
      totalCost: 0.12,
    };
    mockUseQuery.mockReturnValue(mockData as ReturnType<typeof useQuery>);
    const { result } = renderHook(() => useCostByGoal("goal-1"));
    expect(result.current).toEqual(mockData);
  });

  it("returns default shape when goalId is null (skip sentinel path)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useCostByGoal(null));
    expect(result.current).toEqual({ rows: [], totalCost: 0 });
  });
});

describe("useLlmByGoal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when useQuery returns undefined (loading)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useLlmByGoal("goal-1"));
    expect(result.current).toEqual([]);
  });

  it("passes 'skip' sentinel when goalId is null", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useLlmByGoal(null));
    const calls = mockUseQuery.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toBe("skip");
  });

  it("returns rows with agentId for tier-flag join", () => {
    const rows = [
      { agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", cost: 0.05 },
      { agentId: "queen", model: "claude-opus-4-8", provider: "anthropic", cost: 0.10 },
    ];
    mockUseQuery.mockReturnValue(rows as ReturnType<typeof useQuery>);
    const { result } = renderHook(() => useLlmByGoal("goal-1"));
    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toMatchObject({ agentId: "agent-1", model: "claude-sonnet-4-5" });
  });
});
