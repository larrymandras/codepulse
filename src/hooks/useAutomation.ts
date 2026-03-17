import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAutomationSummary() {
  return useQuery(api.automation.cronSummary);
}

export function useRecentCronExecutions(limit?: number) {
  return useQuery(api.automation.recentCrons, limit ? { limit } : {}) ?? [];
}

export function useRecentHeartbeats(limit?: number) {
  return useQuery(api.automation.recentHeartbeats, limit ? { limit } : {}) ?? [];
}

export function useRecentJobs(limit?: number) {
  return useQuery(api.automation.recentJobs, limit ? { limit } : {}) ?? [];
}

export function useRecentSubagentExecutions(limit?: number) {
  return useQuery(api.automation.recentSubagentExecutions, limit ? { limit } : {}) ?? [];
}
