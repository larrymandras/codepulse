import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useHeroStats() {
  return useThrottledQuery(api.heroStats.summary, {}, 1000) ?? {
    activeSessions: 0,
    runningAgents: 0,
    errorRate: 0,
    errorsThisHour: 0,
    eventsThisHour: 0,
    eventSparkline: [],
    activeAlerts: 0,
    criticalAlerts: 0,
    errorAlerts: 0,
    hourlyCost: 0,
    hourlyTokens: 0,
    costSparkline: [],
    knownTools: 0,
    securityEvents: 0,
    health: "green" as const,
  };
}
