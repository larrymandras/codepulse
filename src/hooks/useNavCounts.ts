import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface NavCounts {
  activeSessions: number;
  activeAgents: number;
  recentExecutions: number;
  activeBuildJobs: number;
  automationJobs: number;
  securityEvents: number;
  memoryEntries: number;
  capabilities: number;
  briefings: number;
  unreadAlerts: number;
}

export function useNavCounts(): NavCounts {
  const sessions = useQuery(api.sessions.listActive);
  const agents = useQuery(api.agents.listRunning);
  const executions = useQuery(api.commandExecutions.listExecutions);
  const buildActivity = useQuery(api.build.recentActivity);
  const automation = useQuery(api.automation.recentCrons);
  const security = useQuery(api.security.recentEvents);
  const memory = useQuery(api.memory.overview);
  const capabilities = useQuery(api.registry.listTools);
  const briefings = useQuery(api.reflections.recent);
  const alerts = useQuery(api.alerts.listActive);

  return {
    activeSessions: Array.isArray(sessions) ? sessions.length : 0,
    activeAgents: Array.isArray(agents) ? agents.length : 0,
    recentExecutions: Array.isArray(executions) ? executions.length : 0,
    activeBuildJobs: Array.isArray(buildActivity) ? buildActivity.length : 0,
    automationJobs: Array.isArray(automation) ? automation.length : 0,
    securityEvents: Array.isArray(security) ? security.length : 0,
    memoryEntries: typeof memory === "object" && memory !== null && "totalEntries" in memory ? (memory as any).totalEntries : 0,
    capabilities: Array.isArray(capabilities) ? capabilities.length : 0,
    briefings: Array.isArray(briefings) ? briefings.length : 0,
    unreadAlerts: Array.isArray(alerts) ? alerts.length : 0,
  };
}
