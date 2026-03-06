import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useSecurityEvents() {
  return useQuery(api.security.recentEvents) ?? [];
}

export function useSecurityCounts() {
  return useQuery(api.security.severityCounts);
}
