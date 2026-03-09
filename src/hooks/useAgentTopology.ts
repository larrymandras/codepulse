import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRunningAgents() {
  return useQuery(api.agents.listRunning) ?? [];
}

export function useAllAgents() {
  return useQuery(api.agents.listAll) ?? [];
}

export function useSessionAgents(sessionId: string) {
  return useQuery(api.agents.topology, { sessionId }) ?? [];
}

export function useAgentDetail(agentId: string | null) {
  return useQuery(api.agents.detail, agentId ? { agentId } : "skip") ?? null;
}

export function useCoordinationEvents() {
  return useQuery(api.coordination.recentAll) ?? [];
}
