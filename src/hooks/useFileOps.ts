import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useFileOps(sessionId: string) {
  return useQuery(api.fileOps.bySession, { sessionId }) ?? [];
}

export function useFileOpsSummary(sessionId: string) {
  return useQuery(api.fileOps.summaryBySession, { sessionId }) ?? [];
}
