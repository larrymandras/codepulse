import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useContextHistory(sessionId: string) {
  return useQuery(api.contextSnapshots.historyBySession, { sessionId }) ?? [];
}

export function useLatestContext(sessionId: string) {
  return useQuery(api.contextSnapshots.latestBySession, { sessionId });
}
