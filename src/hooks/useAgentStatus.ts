import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRecentAgentStatus() {
  return useQuery(api.agentStatus.recentByAgent) ?? [];
}

export function useLatestAgentStatus(agentId: string) {
  return useQuery(api.agentStatus.latestForAgent, { agentId });
}
