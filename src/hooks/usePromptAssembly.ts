import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function usePromptAssembly(limit = 50) {
  return useQuery(api.promptAssembly.getRecent, { limit }) ?? [];
}

export function usePromptTrend(days = 30) {
  return useQuery(api.promptAssembly.getTrend, { days }) ?? [];
}
