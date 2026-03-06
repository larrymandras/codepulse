import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRunningAgents() {
  return useQuery(api.agents.listRunning) ?? [];
}

export function useSessionAgents(sessionId: string) {
  return useQuery(api.agents.topology, { sessionId }) ?? [];
}
