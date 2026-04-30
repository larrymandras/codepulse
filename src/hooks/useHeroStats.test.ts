import { describe, it, expect, vi } from "vitest";

vi.mock("../../convex/_generated/api", () => ({
  api: { heroStats: { summary: "heroStats:summary" } },
}));

vi.mock("./usePollQuery", () => ({
  usePollQuery: vi.fn(),
}));

import { usePollQuery } from "./usePollQuery";
import { useHeroStats } from "./useHeroStats";

const mockUsePollQuery = vi.mocked(usePollQuery);

describe("useHeroStats", () => {
  it("returns sensible defaults when query returns undefined", () => {
    mockUsePollQuery.mockReturnValue({ data: undefined, isStale: false, refetch: vi.fn() });
    const stats = useHeroStats();

    expect(stats.activeSessions).toBe(0);
    expect(stats.runningAgents).toBe(0);
    expect(stats.errorRate).toBe(0);
    expect(stats.errorsThisHour).toBe(0);
    expect(stats.eventsThisHour).toBe(0);
    expect(stats.eventSparkline).toEqual([]);
    expect(stats.activeAlerts).toBe(0);
    expect(stats.criticalAlerts).toBe(0);
    expect(stats.errorAlerts).toBe(0);
    expect(stats.hourlyCost).toBe(0);
    expect(stats.hourlyTokens).toBe(0);
    expect(stats.costSparkline).toEqual([]);
    expect(stats.knownTools).toBe(0);
    expect(stats.securityEvents).toBe(0);
    expect(stats.health).toBe("green");
  });

  it("returns query data when available", () => {
    const mockData = {
      activeSessions: 5,
      runningAgents: 3,
      errorRate: 12.5,
      errorsThisHour: 8,
      eventsThisHour: 150,
      eventSparkline: [10, 20, 30],
      activeAlerts: 2,
      criticalAlerts: 1,
      errorAlerts: 1,
      hourlyCost: 0.0523,
      hourlyTokens: 45000,
      costSparkline: [0.01, 0.02, 0.05],
      knownTools: 12,
      securityEvents: 0,
      health: "yellow" as const,
    };
    mockUsePollQuery.mockReturnValue({ data: mockData, isStale: false, refetch: vi.fn() });
    const stats = useHeroStats();

    expect(stats.activeSessions).toBe(5);
    expect(stats.runningAgents).toBe(3);
    expect(stats.errorRate).toBe(12.5);
    expect(stats.health).toBe("yellow");
    expect(stats.eventSparkline).toEqual([10, 20, 30]);
  });
});
